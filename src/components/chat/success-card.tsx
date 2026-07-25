import { CircleCheck, XCircle } from "lucide-react";
import type { Receipt } from "@/lib/domain/types";

export function SuccessCard({ receipt }: { receipt: Receipt }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-success-border bg-success-soft px-3.5 py-3">
      <div className="flex items-center gap-2">
        <CircleCheck className="h-[18px] w-[18px] text-success" />
        <span className="text-sm font-semibold text-text-primary">
          {receipt.kind === "reschedule" && "Delivery rescheduled"}
          {receipt.kind === "change_address" && "Address updated"}
          {receipt.kind === "update_instructions" && "Instructions saved"}
          {receipt.kind === "file_claim" && "Claim filed"}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-text-secondary">
        {receipt.summary} · Confirmation #{receipt.confirmationNumber}
      </p>
    </div>
  );
}

export function CancelledCard() {
  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-bg-subtle px-3.5 py-2.5">
      <XCircle className="h-4 w-4 text-text-secondary" />
      <span className="text-[13px] text-text-secondary">Cancelled — nothing changed.</span>
    </div>
  );
}
