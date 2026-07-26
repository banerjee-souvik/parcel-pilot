import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { actions, shipments } from "@/lib/db/schema";
import { formatDateOnly } from "@/lib/domain/guardrails";
import { confirmProposal, latestProposalId, newChatId, resetDb, runTurns } from "../harness";

describe("happy-track-reschedule", () => {
  beforeEach(resetDb);

  it("verifies before disclosing, proposes a reschedule, and executes on confirm", async () => {
    const chatId = newChatId();
    const result = await runTurns(chatId, [
      "Hi, can you check on SS-4417-DEMO? The last 4 digits of my phone are 7742.",
      // An explicit computed date, not "next Tuesday" — this scenario tests tool ordering and the
      // confirm flow, not the model's relative-date arithmetic (which turned out unreliable: asked
      // to resolve "next Tuesday" itself, gpt-oss-120b once picked a date that was actually a Sunday).
      `Please reschedule it to ${nextWeekday()}, morning window.`,
    ]);

    const verifyIndex = result.toolCalls.findIndex((c) => c.name === "verifyIdentity");
    const detailIndex = result.toolCalls.findIndex((c) => c.name === "getShipmentDetail");
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    if (detailIndex >= 0) {
      expect(verifyIndex).toBeLessThan(detailIndex);
    }

    const proposeCall = result.toolCalls.find((c) => c.name === "proposeReschedule");
    expect(proposeCall).toBeDefined();
    const output = proposeCall?.output as { ok: boolean };
    expect(output.ok).toBe(true);

    const proposalId = await latestProposalId(chatId);
    expect(proposalId).not.toBeNull();
    const confirmed = await confirmProposal(proposalId!, chatId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.confirmationNumber).toMatch(/^RS-/);

    const [action] = await db.select().from(actions).where(eq(actions.id, proposalId!));
    expect(action.state).toBe("executed");
    const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, "SS-4417-DEMO"));
    expect(shipment.deliveryWindow).not.toBeNull();
  });
});

// A guaranteed weekday, 2-6 days out — well inside the 14-day window and never a Sunday.
function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return formatDateOnly(d); // never toISOString() here — see guardrails.ts's comment on why
}
