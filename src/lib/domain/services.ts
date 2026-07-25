import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { actions, chats, messages, shipmentEvents, shipments } from "../db/schema";
import * as guardrails from "./guardrails";
import {
  ActionKind,
  ok,
  refuse,
  Receipt,
  Result,
  ShipmentDetail,
  PublicShipmentSummary,
} from "./types";

// The only module that writes to shipments/actions. Tools and API routes call these functions;
// nothing else touches the DB directly for domain state. See tech-design.md §8.

const CONFIRMATION_PREFIX: Record<ActionKind, string> = {
  reschedule: "RS",
  change_address: "AD",
  update_instructions: "IN",
  file_claim: "CLM",
};

function confirmationNumber(kind: ActionKind): string {
  return `${CONFIRMATION_PREFIX[kind]}-${Math.floor(10000 + Math.random() * 90000)}`;
}

// --- Chat / message persistence (used by the API route; see tech-design.md §11) ---

export async function ensureChat(chatId: string) {
  const [existing] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(chats).values({ id: chatId }).returning();
  return created;
}

export async function loadChat(chatId: string) {
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
  return chat ?? null;
}

export async function loadMessages(chatId: string) {
  return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
}

export async function persistMessage(chatId: string, message: { id: string; role: string; parts: unknown }) {
  await db
    .insert(messages)
    .values({ id: message.id, chatId, role: message.role, parts: message.parts })
    .onConflictDoUpdate({ target: messages.id, set: { parts: message.parts } });
}

export async function setActiveStream(chatId: string, streamId: string | null) {
  await db.update(chats).set({ activeStreamId: streamId }).where(eq(chats.id, chatId));
}

// --- Shipment lookup / disclosure ---

export async function lookupShipment(trackingNumber: string): Promise<Result<PublicShipmentSummary>> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber)).limit(1);
  if (!shipment) {
    return refuse("SHIPMENT_NOT_FOUND", `I couldn't find a shipment with tracking number ${trackingNumber}.`);
  }
  return ok({ trackingNumber: shipment.trackingNumber, status: shipment.status, city: shipment.city });
}

export async function verifyIdentity(chatId: string, trackingNumber: string, phoneLast4: string): Promise<Result<true>> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber)).limit(1);
  if (!shipment) {
    return refuse("SHIPMENT_NOT_FOUND", `I couldn't find a shipment with tracking number ${trackingNumber}.`);
  }
  if (shipment.phoneLast4 !== phoneLast4) {
    return refuse("VERIFY_FAILED", "That doesn't match what we have on file. Want to try again?");
  }
  const chat = await ensureChat(chatId);
  if (!chat.verifiedTrackingNumbers.includes(trackingNumber)) {
    await db
      .update(chats)
      .set({ verifiedTrackingNumbers: [...chat.verifiedTrackingNumbers, trackingNumber] })
      .where(eq(chats.id, chatId));
  }
  return ok(true);
}

export async function getShipmentDetail(chatId: string, trackingNumber: string): Promise<Result<ShipmentDetail>> {
  const chat = await ensureChat(chatId);
  const disclose = guardrails.canDisclose(chat, trackingNumber);
  if (!disclose.ok) return disclose;

  const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber)).limit(1);
  if (!shipment) {
    return refuse("SHIPMENT_NOT_FOUND", `I couldn't find a shipment with tracking number ${trackingNumber}.`);
  }
  const events = await db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.trackingNumber, trackingNumber))
    .orderBy(shipmentEvents.occurredAt);

  return ok({
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    packageCount: shipment.packageCount,
    sender: shipment.sender,
    addressLine: shipment.addressLine,
    city: shipment.city,
    eta: shipment.eta?.toISOString() ?? null,
    originalEta: shipment.originalEta?.toISOString() ?? null,
    deliveryWindow: shipment.deliveryWindow,
    deliveryInstructions: shipment.deliveryInstructions,
    exception: shipment.exception,
    events: events.map((e) => ({ kind: e.kind, summary: e.summary, location: e.location, occurredAt: e.occurredAt.toISOString() })),
  });
}

const RESCHEDULE_WINDOWS = ["09:00-13:00", "13:00-18:00"] as const;

export async function getRescheduleOptions(
  chatId: string,
  trackingNumber: string
): Promise<Result<{ dates: string[]; windows: readonly string[] }>> {
  const chat = await ensureChat(chatId);
  const disclose = guardrails.canDisclose(chat, trackingNumber);
  if (!disclose.ok) return disclose;

  const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber)).limit(1);
  if (!shipment) {
    return refuse("SHIPMENT_NOT_FOUND", `I couldn't find a shipment with tracking number ${trackingNumber}.`);
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Status-based refusals (terminal state, out-for-delivery, customs hold) are the same for every
  // candidate date, so check once up front. Without this, a locked shipment sends the search loop
  // below hunting for a valid date that can never exist — it was an infinite loop before this check.
  const statusCheck = guardrails.canReschedule({ status: shipment.status }, tomorrow, now);
  if (!statusCheck.ok && statusCheck.code !== "INVALID_DATE") {
    return statusCheck;
  }

  const dates: string[] = [];
  const cursor = new Date(tomorrow);
  const maxDate = new Date(tomorrow);
  maxDate.setDate(maxDate.getDate() + 14);
  while (dates.length < 7 && cursor.getTime() <= maxDate.getTime()) {
    if (cursor.getDay() !== 0) {
      const check = guardrails.canReschedule({ status: shipment.status }, cursor, now);
      if (check.ok) dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return ok({ dates, windows: RESCHEDULE_WINDOWS });
}

// --- Two-phase proposals ---

type ProposePayload =
  | { kind: "reschedule"; trackingNumber: string; date: string; window: string }
  | { kind: "change_address"; trackingNumber: string; addressLine: string; city: string }
  | { kind: "update_instructions"; trackingNumber: string; instructions: string }
  | { kind: "file_claim"; trackingNumber: string; type: "damaged" | "missing"; description: string };

export async function proposeAction(
  chatId: string,
  payload: ProposePayload
): Promise<Result<{ proposalId: string; summary: string }>> {
  const chat = await ensureChat(chatId);
  const disclose = guardrails.canDisclose(chat, payload.trackingNumber);
  if (!disclose.ok) return disclose;

  const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, payload.trackingNumber)).limit(1);
  if (!shipment) {
    return refuse("SHIPMENT_NOT_FOUND", `I couldn't find a shipment with tracking number ${payload.trackingNumber}.`);
  }
  let summary: string;
  switch (payload.kind) {
    case "reschedule": {
      const check = guardrails.canReschedule(shipment, new Date(payload.date), new Date());
      if (!check.ok) return check;
      summary = `Reschedule ${payload.trackingNumber} to ${payload.date}, ${payload.window}`;
      break;
    }
    case "change_address": {
      const check = guardrails.canChangeAddress(shipment);
      if (!check.ok) return check;
      summary = `Change delivery address for ${payload.trackingNumber} to ${payload.addressLine}, ${payload.city}`;
      break;
    }
    case "update_instructions": {
      const check = guardrails.canUpdateInstructions(shipment);
      if (!check.ok) return check;
      summary = `Update delivery instructions for ${payload.trackingNumber}`;
      break;
    }
    case "file_claim": {
      const check = guardrails.canFileClaim(shipment);
      if (!check.ok) return check;
      summary = `File a ${payload.type} claim for ${payload.trackingNumber}`;
      break;
    }
  }

  const proposalId = `p_${nanoid(12)}`;
  await db.insert(actions).values({
    id: proposalId,
    chatId,
    trackingNumber: payload.trackingNumber,
    kind: payload.kind,
    payload,
    state: "proposed",
  });

  return ok({ proposalId, summary });
}

// Transaction-scoped client type, inferred from db.transaction's own callback signature.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function executeProposal(proposalId: string, chatId: string): Promise<Result<Receipt & { idempotent?: boolean }>> {
  // SELECT ... FOR UPDATE takes a row lock: a concurrent second call blocks here until the first
  // transaction commits, then observes the real post-commit state instead of racing a bare CAS.
  // This is what makes double-confirm return the SAME receipt to both callers, not just "no second write".
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(actions)
      .where(and(eq(actions.id, proposalId), eq(actions.chatId, chatId)))
      .for("update");

    if (!existing) return refuse("PROPOSAL_NOT_FOUND", "I couldn't find that proposal.");

    if (existing.state === "executed") {
      return ok({ ...(existing.result as Receipt), idempotent: true });
    }
    if (existing.state !== "proposed") {
      const blocked = guardrails.canExecuteProposal(existing, new Date());
      return blocked.ok ? refuse("PROPOSAL_NOT_FOUND", "I couldn't find that proposal.") : blocked;
    }

    const expiry = guardrails.canExecuteProposal(existing, new Date());
    if (!expiry.ok) {
      await tx.update(actions).set({ state: "expired" }).where(eq(actions.id, proposalId));
      return expiry;
    }

    const payload = existing.payload as ProposePayload;
    const receipt = await applyAction(payload, tx);

    await tx
      .update(actions)
      .set({ state: "executed", result: receipt, executedAt: new Date() })
      .where(eq(actions.id, proposalId));

    return ok(receipt);
  });
}

async function applyAction(payload: ProposePayload, tx: Tx): Promise<Receipt> {
  const number = confirmationNumber(payload.kind);
  const eventId = `evt_${nanoid(12)}`;

  switch (payload.kind) {
    case "reschedule": {
      const eta = new Date(`${payload.date}T00:00:00Z`);
      await tx
        .update(shipments)
        .set({ eta, deliveryWindow: payload.window, updatedAt: new Date() })
        .where(eq(shipments.trackingNumber, payload.trackingNumber));
      await tx.insert(shipmentEvents).values({
        id: eventId,
        trackingNumber: payload.trackingNumber,
        kind: "reschedule",
        summary: `Delivery rescheduled to ${payload.date}, ${payload.window}`,
        location: null,
        occurredAt: new Date(),
      });
      return {
        confirmationNumber: number,
        kind: payload.kind,
        trackingNumber: payload.trackingNumber,
        summary: `Now arrives ${payload.date}, ${payload.window}`,
      };
    }
    case "change_address": {
      await tx
        .update(shipments)
        .set({ addressLine: payload.addressLine, city: payload.city, updatedAt: new Date() })
        .where(eq(shipments.trackingNumber, payload.trackingNumber));
      await tx.insert(shipmentEvents).values({
        id: eventId,
        trackingNumber: payload.trackingNumber,
        kind: "address_updated",
        summary: `Delivery address updated to ${payload.addressLine}, ${payload.city}`,
        location: null,
        occurredAt: new Date(),
      });
      return {
        confirmationNumber: number,
        kind: payload.kind,
        trackingNumber: payload.trackingNumber,
        summary: `Delivery address updated to ${payload.addressLine}, ${payload.city}`,
      };
    }
    case "update_instructions": {
      await tx
        .update(shipments)
        .set({ deliveryInstructions: payload.instructions, updatedAt: new Date() })
        .where(eq(shipments.trackingNumber, payload.trackingNumber));
      await tx.insert(shipmentEvents).values({
        id: eventId,
        trackingNumber: payload.trackingNumber,
        kind: "instructions_updated",
        summary: `Delivery instructions updated`,
        location: null,
        occurredAt: new Date(),
      });
      return {
        confirmationNumber: number,
        kind: payload.kind,
        trackingNumber: payload.trackingNumber,
        summary: `Instructions saved for the courier`,
      };
    }
    case "file_claim": {
      await tx.insert(shipmentEvents).values({
        id: eventId,
        trackingNumber: payload.trackingNumber,
        kind: "claim_filed",
        summary: `${payload.type === "damaged" ? "Damage" : "Missing item"} claim filed: ${payload.description}`,
        location: null,
        occurredAt: new Date(),
      });
      return {
        confirmationNumber: number,
        kind: payload.kind,
        trackingNumber: payload.trackingNumber,
        summary: `Claim ${number} filed and under review`,
      };
    }
  }
}

export async function cancelProposal(proposalId: string, chatId: string): Promise<Result<true>> {
  const [cancelled] = await db
    .update(actions)
    .set({ state: "cancelled" })
    .where(and(eq(actions.id, proposalId), eq(actions.chatId, chatId), eq(actions.state, "proposed")))
    .returning();
  if (!cancelled) {
    return refuse("PROPOSAL_NOT_FOUND", "I couldn't find that proposal to cancel.");
  }
  return ok(true);
}
