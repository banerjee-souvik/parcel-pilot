import { CalendarClock, Info, MapPin, MessageSquareWarning, PackageSearch } from "lucide-react";

const SUGGESTIONS = [
  { icon: MapPin, label: "Track my shipment", message: "I'd like to track my shipment" },
  { icon: CalendarClock, label: "Reschedule a delivery", message: "I need to reschedule a delivery" },
  { icon: MessageSquareWarning, label: "Report a damaged parcel", message: "My parcel arrived damaged" },
] as const;

export function WelcomeState({ onSuggestion }: { onSuggestion: (message: string) => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-6 px-5 pb-8 pt-9">
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent-soft">
          <PackageSearch className="h-8 w-8 text-accent" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Where&apos;s your package?</h1>
        <p className="text-center text-sm leading-relaxed text-text-secondary">
          I can track shipments, reschedule deliveries, update instructions or file a claim. Start with your
          tracking number.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {SUGGESTIONS.map(({ icon: Icon, label, message }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSuggestion(message)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-3 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-subtle"
          >
            <Icon className="h-[18px] w-[18px] shrink-0 text-accent" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col gap-1.5 rounded-xl bg-bg-subtle px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-text-secondary" />
          <span className="text-xs font-semibold text-text-secondary">DEMO DATA</span>
        </div>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Try SS-4417-DEMO (delayed by weather) or SS-9021-DEMO (out for delivery). Verification code: 7742.
        </p>
      </div>
    </div>
  );
}
