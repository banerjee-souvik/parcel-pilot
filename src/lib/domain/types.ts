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
