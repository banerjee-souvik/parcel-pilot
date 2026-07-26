import { ActionState, ok, refuse, Result, ShipmentStatus } from "./types";

// Pure functions only — no DB access, no I/O. Every rule the model must obey is enforced here,
// not in the prompt. See tech-design.md §7 for the rules matrix this file implements.

const PROPOSAL_TTL_MS = 15 * 60 * 1000;

// Calendar-only dates ("2026-08-02") must never round-trip through UTC — `new Date("2026-08-02")`
// parses as UTC midnight per spec, and `.toISOString().slice(0,10)` serializes in UTC, either of
// which can silently shift the calendar day (and therefore the day-of-week) by one once the server's
// local timezone differs from UTC. Confirmed for real: running locally in IST just after local
// midnight produced a "Sunday" rejection for a date every local calculation agreed was Monday — the
// UTC string crossed the day boundary the local Date object hadn't. These two helpers are the only
// sanctioned way to move a reschedule date between a Date and a string; local getters only, never UTC.
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function canDisclose(chat: { verifiedTrackingNumbers: string[] }, trackingNumber: string): Result<true> {
  if (!chat.verifiedTrackingNumbers.includes(trackingNumber)) {
    return refuse("NOT_VERIFIED", "I need to verify your identity before sharing shipment details. What's the last 4 digits of the phone number on this order?");
  }
  return ok(true);
}

function terminalOrLocked(status: ShipmentStatus): Result<true> | null {
  if (status === "delivered" || status === "lost") {
    return refuse("TERMINAL_STATE", "This shipment has already reached a final state, so it can't be changed.");
  }
  if (status === "out_for_delivery") {
    return refuse("OUT_FOR_DELIVERY_LOCKED", "This parcel is already out for delivery today, so I can't reschedule or redirect it now.");
  }
  if (status === "customs_hold") {
    return refuse("NOT_IN_REGION_YET", "This shipment is still held in customs and hasn't entered local delivery yet, so there's nothing to reschedule until it clears.");
  }
  return null;
}

export function canReschedule(shipment: { status: ShipmentStatus }, requestedDate: Date, now: Date): Result<true> {
  const locked = terminalOrLocked(shipment.status);
  if (locked) return locked;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfRequested = new Date(requestedDate);
  startOfRequested.setHours(0, 0, 0, 0);

  if (startOfRequested.getTime() <= startOfToday.getTime()) {
    return refuse("INVALID_DATE", "That date has already passed — please pick a day after today.");
  }

  const maxDate = new Date(startOfToday);
  maxDate.setDate(maxDate.getDate() + 14);
  if (startOfRequested.getTime() > maxDate.getTime()) {
    return refuse("INVALID_DATE", "I can only reschedule within the next 14 days.");
  }

  if (startOfRequested.getDay() === 0) {
    return refuse("INVALID_DATE", "Sunday isn't served on this route — pick another day.");
  }

  return ok(true);
}

export function canChangeAddress(shipment: { status: ShipmentStatus }): Result<true> {
  const locked = terminalOrLocked(shipment.status);
  if (locked) return locked;
  return ok(true);
}

export function canUpdateInstructions(shipment: { status: ShipmentStatus }): Result<true> {
  if (shipment.status === "delivered" || shipment.status === "lost") {
    return refuse("TERMINAL_STATE", "This shipment has already reached a final state, so there's nothing left to instruct the courier about.");
  }
  return ok(true);
}

export function canFileClaim(shipment: { status: ShipmentStatus }): Result<true> {
  if (shipment.status !== "delivered" && shipment.status !== "lost") {
    return refuse("CLAIM_NOT_ELIGIBLE", "Claims can only be filed once a shipment is delivered or confirmed lost.");
  }
  return ok(true);
}

export function canExecuteProposal(action: { state: ActionState; createdAt: Date }, now: Date): Result<true> {
  if (action.state === "executed") {
    return refuse("PROPOSAL_ALREADY_EXECUTED", "This action was already completed.");
  }
  if (action.state === "cancelled") {
    return refuse("PROPOSAL_CANCELLED", "This proposal was cancelled.");
  }
  if (action.state === "expired") {
    return refuse("PROPOSAL_EXPIRED", "This proposal expired — please ask again to get a fresh one.");
  }
  if (now.getTime() - action.createdAt.getTime() > PROPOSAL_TTL_MS) {
    return refuse("PROPOSAL_EXPIRED", "This proposal expired — please ask again to get a fresh one.");
  }
  return ok(true);
}
