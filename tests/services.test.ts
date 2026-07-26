import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { actions } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed";
import * as services from "@/lib/domain/services";

beforeEach(seedDatabase);

async function propose(chatId: string, date = nextWeekday()) {
  await services.verifyIdentity(chatId, "SS-4417-DEMO", "7742");
  const result = await services.proposeAction(chatId, {
    kind: "reschedule",
    trackingNumber: "SS-4417-DEMO",
    date,
    window: "09:00-13:00",
  });
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.proposalId;
}

describe("proposal state machine", () => {
  it("proposed -> executed on confirm", async () => {
    const proposalId = await propose("c_svc_1");
    const result = await services.executeProposal(proposalId, "c_svc_1");
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(actions).where(eq(actions.id, proposalId));
    expect(row.state).toBe("executed");
  });

  it("proposed -> cancelled on cancel", async () => {
    const proposalId = await propose("c_svc_2");
    const result = await services.cancelProposal(proposalId, "c_svc_2");
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(actions).where(eq(actions.id, proposalId));
    expect(row.state).toBe("cancelled");
  });

  it("cannot confirm an already-cancelled proposal", async () => {
    const proposalId = await propose("c_svc_3");
    await services.cancelProposal(proposalId, "c_svc_3");
    const result = await services.executeProposal(proposalId, "c_svc_3");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_CANCELLED");
  });

  it("cannot cancel an already-executed proposal", async () => {
    const proposalId = await propose("c_svc_4");
    await services.executeProposal(proposalId, "c_svc_4");
    const result = await services.cancelProposal(proposalId, "c_svc_4");
    expect(result.ok).toBe(false);
  });

  it("confirming an already-executed proposal is idempotent, not an error", async () => {
    const proposalId = await propose("c_svc_5");
    const first = await services.executeProposal(proposalId, "c_svc_5");
    const second = await services.executeProposal(proposalId, "c_svc_5");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data.idempotent).toBe(true);
      expect(second.data.confirmationNumber).toBe(first.data.confirmationNumber);
    }
  });

  it("cannot confirm a proposal scoped to a different chat", async () => {
    const proposalId = await propose("c_svc_6");
    const result = await services.executeProposal(proposalId, "c_svc_other");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("confirming an unknown proposal id refuses cleanly", async () => {
    const result = await services.executeProposal("p_does_not_exist", "c_svc_7");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_NOT_FOUND");
  });
});

describe("concurrency: double-confirm never executes twice", () => {
  it("ten concurrent confirms on the same proposal execute exactly once", async () => {
    const proposalId = await propose("c_svc_race");
    const results = await Promise.all(Array.from({ length: 10 }, () => services.executeProposal(proposalId, "c_svc_race")));

    expect(results.every((r) => r.ok)).toBe(true);
    const confirmationNumbers = new Set(results.filter((r) => r.ok).map((r) => (r.ok ? r.data.confirmationNumber : "")));
    expect(confirmationNumbers.size).toBe(1);

    const idempotentCount = results.filter((r) => r.ok && r.data.idempotent).length;
    expect(idempotentCount).toBe(9);
  });
});

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
