import { describe, expect, it } from "vitest";
import * as guardrails from "@/lib/domain/guardrails";
import type { ShipmentStatus } from "@/lib/domain/types";

const ALL_STATUSES: ShipmentStatus[] = [
  "label_created",
  "in_transit",
  "exception",
  "customs_hold",
  "out_for_delivery",
  "attempt_failed",
  "delivered",
  "lost",
];

// The full rules matrix from tech-design.md §7 — every status × every action, not just the
// highlighted cells, since the guardrail functions don't special-case label_created/attempt_failed
// beyond falling through to "allowed" and that fallthrough is exactly what needs a test.
const LOCKED_STATUSES: Record<ShipmentStatus, string | null> = {
  label_created: null,
  in_transit: null,
  exception: null,
  attempt_failed: null,
  out_for_delivery: "OUT_FOR_DELIVERY_LOCKED",
  customs_hold: "NOT_IN_REGION_YET",
  delivered: "TERMINAL_STATE",
  lost: "TERMINAL_STATE",
};

describe("canReschedule / canChangeAddress — status matrix", () => {
  const validDate = nextWeekday();
  for (const status of ALL_STATUSES) {
    const expectedRefusal = LOCKED_STATUSES[status];

    it(`reschedule: ${status} ${expectedRefusal ? `refuses (${expectedRefusal})` : "is allowed"}`, () => {
      const result = guardrails.canReschedule({ status }, guardrails.parseDateOnly(validDate), new Date());
      if (expectedRefusal) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe(expectedRefusal);
      } else {
        expect(result.ok).toBe(true);
      }
    });

    it(`change_address: ${status} ${expectedRefusal ? `refuses (${expectedRefusal})` : "is allowed"}`, () => {
      const result = guardrails.canChangeAddress({ status });
      if (expectedRefusal) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe(expectedRefusal);
      } else {
        expect(result.ok).toBe(true);
      }
    });
  }
});

describe("canUpdateInstructions — status matrix", () => {
  for (const status of ALL_STATUSES) {
    const shouldRefuse = status === "delivered" || status === "lost";
    it(`${status} ${shouldRefuse ? "refuses (TERMINAL_STATE)" : "is allowed"}`, () => {
      const result = guardrails.canUpdateInstructions({ status });
      if (shouldRefuse) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("TERMINAL_STATE");
      } else {
        expect(result.ok).toBe(true);
      }
    });
  }
});

describe("canFileClaim — status matrix", () => {
  for (const status of ALL_STATUSES) {
    const shouldAllow = status === "delivered" || status === "lost";
    it(`${status} ${shouldAllow ? "is allowed" : "refuses (CLAIM_NOT_ELIGIBLE)"}`, () => {
      const result = guardrails.canFileClaim({ status });
      if (shouldAllow) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("CLAIM_NOT_ELIGIBLE");
      }
    });
  }
});

describe("canReschedule — date edges", () => {
  const now = new Date(2026, 6, 27); // fixed reference point: Mon, 2026-07-27

  it("refuses today", () => {
    const result = guardrails.canReschedule({ status: "in_transit" }, now, now);
    expect(result.ok).toBe(false);
  });

  it("refuses a date in the past", () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const result = guardrails.canReschedule({ status: "in_transit" }, yesterday, now);
    expect(result.ok).toBe(false);
  });

  it("allows exactly 14 days out", () => {
    const in14 = new Date(now);
    in14.setDate(in14.getDate() + 14);
    if (in14.getDay() === 0) in14.setDate(in14.getDate() + 1); // keep the boundary test off a Sunday
    const result = guardrails.canReschedule({ status: "in_transit" }, in14, now);
    expect(result.ok).toBe(true);
  });

  it("refuses 15 days out", () => {
    const in15 = new Date(now);
    in15.setDate(in15.getDate() + 15);
    const result = guardrails.canReschedule({ status: "in_transit" }, in15, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_DATE");
  });

  it("refuses a Sunday", () => {
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
    const result = guardrails.canReschedule({ status: "in_transit" }, sunday, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_DATE");
  });

  it("allows a valid weekday within range", () => {
    const result = guardrails.canReschedule({ status: "in_transit" }, guardrails.parseDateOnly(nextWeekday()), new Date());
    expect(result.ok).toBe(true);
  });
});

describe("canExecuteProposal — state machine", () => {
  const now = new Date();

  it("allows a fresh proposal", () => {
    const result = guardrails.canExecuteProposal({ state: "proposed", createdAt: now }, now);
    expect(result.ok).toBe(true);
  });

  it("refuses an already-executed proposal", () => {
    const result = guardrails.canExecuteProposal({ state: "executed", createdAt: now }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_ALREADY_EXECUTED");
  });

  it("refuses a cancelled proposal", () => {
    const result = guardrails.canExecuteProposal({ state: "cancelled", createdAt: now }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_CANCELLED");
  });

  it("refuses a proposal already marked expired", () => {
    const result = guardrails.canExecuteProposal({ state: "expired", createdAt: now }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_EXPIRED");
  });

  it("refuses a stale proposal past the 15-minute TTL, even if still marked 'proposed'", () => {
    const old = new Date(now.getTime() - 16 * 60 * 1000);
    const result = guardrails.canExecuteProposal({ state: "proposed", createdAt: old }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROPOSAL_EXPIRED");
  });

  it("allows a proposal just under the TTL", () => {
    const recent = new Date(now.getTime() - 14 * 60 * 1000);
    const result = guardrails.canExecuteProposal({ state: "proposed", createdAt: recent }, now);
    expect(result.ok).toBe(true);
  });
});

describe("canDisclose", () => {
  it("refuses when the tracking number hasn't been verified in this chat", () => {
    const result = guardrails.canDisclose({ verifiedTrackingNumbers: [] }, "SS-4417-DEMO");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_VERIFIED");
  });

  it("allows once the tracking number is in the chat's verified list", () => {
    const result = guardrails.canDisclose({ verifiedTrackingNumbers: ["SS-4417-DEMO"] }, "SS-4417-DEMO");
    expect(result.ok).toBe(true);
  });

  it("does not leak verification across different tracking numbers", () => {
    const result = guardrails.canDisclose({ verifiedTrackingNumbers: ["SS-9021-DEMO"] }, "SS-4417-DEMO");
    expect(result.ok).toBe(false);
  });
});

describe("canEngageShipment — one shipment per chat, for the chat's whole lifetime", () => {
  it("allows the first shipment a chat ever touches", () => {
    const result = guardrails.canEngageShipment({ scopedTrackingNumber: null }, "SS-4417-DEMO");
    expect(result.ok).toBe(true);
  });

  it("allows repeated calls for the same shipment once scoped", () => {
    const result = guardrails.canEngageShipment({ scopedTrackingNumber: "SS-4417-DEMO" }, "SS-4417-DEMO");
    expect(result.ok).toBe(true);
  });

  it("refuses a different shipment once the chat is already scoped", () => {
    const result = guardrails.canEngageShipment({ scopedTrackingNumber: "SS-4417-DEMO" }, "SS-9021-DEMO");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SHIPMENT_SESSION_LOCKED");
      expect(result.message).toContain("SS-4417-DEMO");
    }
  });
});

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return guardrails.formatDateOnly(d);
}
