import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { newChatId, resetDb, runTurns } from "../harness";

describe("shipment-session-scope", () => {
  beforeEach(resetDb);

  it("refuses to engage a second shipment once the chat is scoped to the first", async () => {
    const chatId = newChatId();
    const result = await runTurns(chatId, [
      // Tracking number + verification code together, so the first turn reliably makes a tool call
      // for SS-4417-DEMO (and locks the chat's scope) instead of just asking a clarifying question
      // first — the same non-determinism decisions.md #13 already documented elsewhere.
      "Where is SS-4417-DEMO? My phone's last 4 digits are 7742.",
      "Actually, can you also check on SS-9021-DEMO for me?",
    ]);

    // The one fact that actually matters, checked directly against the DB rather than the model's
    // prose or tool-call choices: the chat's lock never moved off the first shipment. This holds
    // regardless of *how* the model handled the second request — whether it tried a tool and got a
    // SHIPMENT_SESSION_LOCKED refusal back, or (observed in practice) skipped the tool call entirely
    // and declined from context, both are correct as long as this fact holds.
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    expect(chat?.scopedTrackingNumber).toBe("SS-4417-DEMO");

    // If a tool call for the second shipment *was* attempted, it must have failed — never silently
    // succeed just because the model tried anyway.
    const secondShipmentCalls = result.toolCalls.filter(
      (c) => typeof c.input === "object" && c.input !== null && (c.input as { trackingNumber?: string }).trackingNumber === "SS-9021-DEMO"
    );
    for (const call of secondShipmentCalls) {
      expect((call.output as { ok: boolean }).ok).toBe(false);
    }

    // The refusal must actually reach the user in some form, not just exist as internal state.
    // "chat" vs "conversation" is exactly the kind of paraphrase the system prompt permits (and a
    // real run produced "start a new conversation") — check for either, same leniency principle as
    // reschedule-invalid-date.eval.ts.
    const combinedText = result.textByTurn.join(" ").toLowerCase();
    expect(combinedText).toMatch(/new (chat|conversation|session)/);
  });
});
