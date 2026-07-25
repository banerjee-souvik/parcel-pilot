import type { UIMessage } from "ai";
import type { ProposalSummary, Receipt, ShipmentDetail } from "@/lib/domain/types";
import { ConfirmCard } from "./confirm-card";
import { DatePickerCard } from "./date-picker-card";
import { TimelineCard } from "./timeline-card";
import { CancelledCard, SuccessCard } from "./success-card";

type ToolPartLike = {
  type: string;
  state?: string;
  output?: unknown;
  errorText?: string;
  data?: unknown;
};

const PROPOSE_TOOLS = new Set([
  "tool-proposeReschedule",
  "tool-proposeAddressChange",
  "tool-proposeInstructionsUpdate",
  "tool-proposeClaim",
]);

export function ToolPart({
  part,
  index,
  chatId,
  onSendMessage,
  onResolved,
}: {
  part: ToolPartLike;
  index: number;
  chatId: string;
  onSendMessage: (message: string) => void;
  onResolved: (message: UIMessage) => void;
}) {
  if (part.type === "data-receipt") {
    const data = part.data as { status: "executed" | "cancelled"; receipt?: Receipt };
    return data.status === "executed" && data.receipt ? (
      <SuccessCard key={index} receipt={data.receipt} />
    ) : (
      <CancelledCard key={index} />
    );
  }

  if (part.type === "tool-getShipmentDetail" && part.state === "output-available") {
    const output = part.output as { ok: boolean; data?: ShipmentDetail };
    return output.ok && output.data ? <TimelineCard key={index} detail={output.data} /> : null;
  }

  if (part.type === "tool-getRescheduleOptions" && part.state === "output-available") {
    const output = part.output as { ok: boolean; data?: { dates: string[]; windows: readonly string[] } };
    return output.ok && output.data ? (
      <DatePickerCard key={index} dates={output.data.dates} windows={output.data.windows} onSelect={onSendMessage} />
    ) : null;
  }

  if (PROPOSE_TOOLS.has(part.type) && part.state === "output-available") {
    const output = part.output as { ok: boolean; data?: ProposalSummary };
    return output.ok && output.data ? (
      <ConfirmCard key={index} chatId={chatId} proposal={output.data} onResolved={onResolved} />
    ) : null;
  }

  if (part.state === "output-error") {
    return (
      <p key={index} className="text-xs font-medium text-danger">
        {part.errorText ?? "Something went wrong."}
      </p>
    );
  }

  return null;
}
