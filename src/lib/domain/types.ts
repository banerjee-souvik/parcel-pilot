export type ShipmentStatus =
  | "label_created"
  | "in_transit"
  | "exception"
  | "customs_hold"
  | "out_for_delivery"
  | "attempt_failed"
  | "delivered"
  | "lost";

export type ActionKind = "reschedule" | "change_address" | "update_instructions" | "file_claim";

export type ActionState = "proposed" | "confirmed" | "executed" | "failed" | "cancelled" | "expired";

export type RefusalCode =
  | "SHIPMENT_SESSION_LOCKED"
  | "NOT_VERIFIED"
  | "VERIFY_FAILED"
  | "SHIPMENT_NOT_FOUND"
  | "TERMINAL_STATE"
  | "OUT_FOR_DELIVERY_LOCKED"
  | "NOT_IN_REGION_YET"
  | "INVALID_DATE"
  | "CLAIM_NOT_ELIGIBLE"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_ALREADY_EXECUTED"
  | "PROPOSAL_CANCELLED"
  | "PROPOSAL_NOT_FOUND";

export type Refusal = { ok: false; code: RefusalCode; message: string };
export type Ok<T> = { ok: true; data: T };
export type Result<T> = Ok<T> | Refusal;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function refuse(code: RefusalCode, message: string): Refusal {
  return { ok: false, code, message };
}

export type PublicShipmentSummary = {
  trackingNumber: string;
  status: ShipmentStatus;
  city: string;
};

export type ShipmentEventView = {
  kind: string;
  summary: string;
  location: string | null;
  occurredAt: string;
  // Pre-formatted for the model to quote in prose — see src/lib/format.ts. `occurredAt` stays raw
  // ISO for the timeline card's own Intl formatting.
  occurredAtDisplay: string;
};

export type ShipmentDetail = {
  trackingNumber: string;
  status: ShipmentStatus;
  packageCount: number;
  sender: string;
  addressLine: string;
  city: string;
  eta: string | null;
  originalEta: string | null;
  // Pre-formatted companions to eta/originalEta — see src/lib/format.ts.
  etaDisplay: string | null;
  originalEtaDisplay: string | null;
  deliveryWindow: string | null;
  deliveryInstructions: string | null;
  exception: { code: string; summary: string } | null;
  events: ShipmentEventView[];
};

export type Receipt = {
  confirmationNumber: string;
  kind: ActionKind;
  trackingNumber: string;
  summary: string;
};

export type ProposalRow = { label: string; value: string };

export type ProposalSummary = {
  proposalId: string;
  summary: string; // plain-English sentence, for the model to reference in prose
  title: string; // card header, e.g. "Confirm reschedule"
  rows: ProposalRow[]; // structured before/after detail for the confirm card
  note: string; // reassurance line ("nothing changes until you confirm")
};
