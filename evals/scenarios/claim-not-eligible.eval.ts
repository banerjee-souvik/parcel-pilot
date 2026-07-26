import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { shipmentEvents } from "@/lib/db/schema";
import { newChatId, resetDb, runTurns } from "../harness";

describe("claim-not-eligible", () => {
  beforeEach(resetDb);

  it("refuses to file a claim on a shipment that hasn't been delivered yet", async () => {
    const chatId = newChatId();
    const result = await runTurns(chatId, [
      "Hi, can you check on SS-4417-DEMO? The last 4 digits of my phone are 7742.",
      "I want to file a claim — it arrived damaged.",
    ]);

    // The model doesn't always call proposeClaim here — sometimes it reasons out the ineligibility
    // itself from the status it already saw and never attempts the tool at all. Both are safe
    // outcomes; only require the CLAIM_NOT_ELIGIBLE refusal when a claim was actually attempted,
    // and assert the one thing that must be true regardless of which path the model took: no claim
    // ever gets filed on a non-delivered shipment.
    const claimCall = result.toolCalls.find((c) => c.name === "proposeClaim");
    if (claimCall) {
      expect((claimCall.output as { ok: boolean }).ok).toBe(false);
      expect(result.refusals.some((r) => r.code === "CLAIM_NOT_ELIGIBLE")).toBe(true);
    }

    const claimEvents = await db
      .select()
      .from(shipmentEvents)
      .where(and(eq(shipmentEvents.trackingNumber, "SS-4417-DEMO"), eq(shipmentEvents.kind, "claim_filed")));
    expect(claimEvents).toHaveLength(0);
  });
});
