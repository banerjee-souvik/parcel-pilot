import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { formatDateOnly } from "@/lib/domain/guardrails";
import { newChatId, resetDb, runTurns } from "../harness";

describe("reschedule-invalid-date", () => {
  beforeEach(resetDb);

  it("refuses a reschedule request for a Sunday", async () => {
    const chatId = newChatId();
    const result = await runTurns(chatId, [
      "Hi, can you check on SS-4417-DEMO? The last 4 digits of my phone are 7742.",
      `Please reschedule it to ${nextSunday()}, morning window.`,
    ]);

    expect(result.refusals.some((r) => r.code === "INVALID_DATE")).toBe(true);
    // The refusal must actually reach the user, not just exist in a tool result the model ignores
    // (leniently, per tech-design.md §14 — check the model relayed the reason, not exact wording).
    // "sunday" itself is too brittle: the system prompt explicitly allows paraphrasing, and a
    // faithful paraphrase ("that day isn't served on this route") can drop the specific day name
    // while preserving the substance. "route" is lifted from guardrails.ts's actual message text
    // and survived a real paraphrase in practice — check for that instead.
    const combinedText = result.textByTurn.join(" ").toLowerCase();
    expect(combinedText).toContain("route");

    const proposeCall = result.toolCalls.find((c) => c.name === "proposeReschedule");
    if (proposeCall) {
      expect((proposeCall.output as { ok: boolean }).ok).toBe(false);
    }
    const rows = await db.select().from(actions).where(eq(actions.trackingNumber, "SS-4417-DEMO"));
    expect(rows).toHaveLength(0);
  });
});

function nextSunday(): string {
  const d = new Date();
  const daysUntilSunday = ((7 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysUntilSunday);
  return formatDateOnly(d); // never toISOString() here — see guardrails.ts's comment on why
}
