import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  FileWarning,
  MapPinned,
  PencilLine,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ShipmentDetail } from "@/lib/domain/types";

const EVENT_STYLE: Record<string, { icon: LucideIcon; tone: "success" | "warn" | "accent" }> = {
  pickup: { icon: CircleCheck, tone: "success" },
  depart_hub: { icon: CircleCheck, tone: "success" },
  arrive_hub: { icon: CircleCheck, tone: "success" },
  out_for_delivery: { icon: CircleCheck, tone: "success" },
  delivered: { icon: CircleCheck, tone: "success" },
  exception: { icon: TriangleAlert, tone: "warn" },
  customs_hold: { icon: TriangleAlert, tone: "warn" },
  attempt_failed: { icon: TriangleAlert, tone: "warn" },
  reschedule: { icon: CalendarClock, tone: "accent" },
  address_updated: { icon: MapPinned, tone: "accent" },
  instructions_updated: { icon: PencilLine, tone: "accent" },
  claim_filed: { icon: FileWarning, tone: "warn" },
};

export const STATUS_BADGE: Record<ShipmentDetail["status"], { label: string; tone: "success" | "warn" | "accent" | "neutral" }> = {
  label_created: { label: "Label created", tone: "neutral" },
  in_transit: { label: "In transit", tone: "accent" },
  exception: { label: "Exception", tone: "warn" },
  customs_hold: { label: "Customs hold", tone: "warn" },
  out_for_delivery: { label: "Out for delivery", tone: "success" },
  attempt_failed: { label: "Delivery attempt failed", tone: "warn" },
  delivered: { label: "Delivered", tone: "success" },
  lost: { label: "Lost", tone: "warn" },
};

export const TONE_CLASSES = {
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-bg-subtle text-text-secondary",
};

const ICON_TONE_CLASSES = {
  success: "text-success",
  warn: "text-warn",
  accent: "text-accent",
};

export function TimelineCard({ detail }: { detail: ShipmentDetail }) {
  const badge = detail.exception
    ? { label: detail.exception.summary, tone: "warn" as const }
    : STATUS_BADGE[detail.status];

  const showEstimate = detail.eta && detail.status !== "delivered" && detail.status !== "lost";

  return (
    <div
      role="group"
      aria-label={`Shipment timeline for ${detail.trackingNumber}`}
      className="w-full overflow-hidden rounded-2xl border border-border bg-bg"
    >
      <div className="flex items-center justify-between gap-3 bg-bg-subtle px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-text-primary">{detail.trackingNumber}</span>
          <span className="text-xs text-text-secondary">
            {detail.packageCount} {detail.packageCount === 1 ? "package" : "packages"} · from {detail.sender}
          </span>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[badge.tone])}>
          {badge.label}
        </span>
      </div>

      <ol className="flex list-none flex-col px-3.5 py-3">
        {detail.events.map((event, i) => {
          const style = EVENT_STYLE[event.kind] ?? { icon: CircleDashed, tone: "accent" as const };
          const Icon = style.icon;
          const isWarn = style.tone === "warn";
          return (
            <li key={i} className="flex gap-2.5 py-1.5">
              <Icon className={cn("mt-0.5 h-[17px] w-[17px] shrink-0", ICON_TONE_CLASSES[style.tone])} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-[13px]", isWarn ? "font-semibold text-warn" : "font-medium text-text-primary")}>
                  {event.summary}
                </span>
                <span className="text-xs leading-relaxed text-text-secondary">
                  {event.location ? `${event.location} · ` : ""}
                  {formatDisplayDateTime(event.occurredAt)}
                </span>
              </div>
            </li>
          );
        })}

        {showEstimate && (
          <li className="flex gap-2.5 py-1.5">
            <CircleDashed className="mt-0.5 h-[17px] w-[17px] shrink-0 text-text-secondary" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-medium text-text-primary">Estimated delivery</span>
              <span className="text-xs leading-relaxed text-text-secondary">
                {formatDisplayDate(detail.eta!)}
                {detail.originalEta && detail.originalEta !== detail.eta
                  ? ` (revised from ${formatDisplayDate(detail.originalEta)})`
                  : ""}
              </span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
