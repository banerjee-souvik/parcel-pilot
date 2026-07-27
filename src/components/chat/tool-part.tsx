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

// Tools whose output renders as a card get a skeleton while executing (tech-design.md §13). Tools
// with no card representation (lookupShipment, verifyIdentity, escalateToHuman) render nothing at
// that stage either way, so there's no shape worth previewing.
const CARD_TOOLS = new Set(["tool-getShipmentDetail", "tool-getRescheduleOptions", ...PROPOSE_TOOLS]);

function CardSkeleton() {
  return (
    <div className="w-full animate-pulse overflow-hidden rounded-2xl border border-border bg-bg">
      <div className="h-11 bg-bg-subtle" />
      <div className="flex flex-col gap-2 p-3.5">
        <div className="h-3 w-3/4 rounded bg-bg-subtle" />
        <div className="h-3 w-1/2 rounded bg-bg-subtle" />
      </div>
    </div>
  );
}

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

  if (CARD_TOOLS.has(part.type) && (part.state === "input-streaming" || part.state === "input-available")) {
    return <CardSkeleton key={index} />;
  }

  return null;
}
