import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { shipmentEvents } from "@/lib/db/schema";
import { formatDateOnly } from "@/lib/domain/guardrails";
import * as services from "@/lib/domain/services";
import { confirmProposal, newChatId, resetDb } from "../harness";

// Harness-level only — no LLM involved. This tests executeProposal's own concurrency guarantee
// (the SELECT ... FOR UPDATE row lock from decisions.md #12's crown jewel), not model behavior.
describe("double-confirm-idempotent", () => {
  beforeEach(resetDb);

  it("confirming the same proposal twice concurrently executes exactly once", async () => {
    const chatId = newChatId();
    await services.verifyIdentity(chatId, "SS-4417-DEMO", "7742");
    const proposed = await services.proposeAction(chatId, {
      kind: "reschedule",
      trackingNumber: "SS-4417-DEMO",
      date: nextMonday(),
      window: "09:00-13:00",
    });
    if (!proposed.ok) throw new Error(`setup failed: ${proposed.message}`);

    const [first, second] = await Promise.all([
      confirmProposal(proposed.data.proposalId, chatId),
      confirmProposal(proposed.data.proposalId, chatId),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.confirmationNumber).toBe(second.data.confirmationNumber);
    // Exactly one of the two calls should observe itself as the idempotent replay.
    expect([first.data.idempotent, second.data.idempotent].filter(Boolean)).toHaveLength(1);

    const events = await db
      .select()
      .from(shipmentEvents)
      .where(and(eq(shipmentEvents.trackingNumber, "SS-4417-DEMO"), eq(shipmentEvents.kind, "reschedule")));
    expect(events).toHaveLength(1);
  });
});

function nextMonday(): string {
  const d = new Date();
  const daysUntilMonday = ((1 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return formatDateOnly(d); // never toISOString() here — see guardrails.ts's comment on why
}
