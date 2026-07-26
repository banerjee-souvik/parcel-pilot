import { cn } from "@/lib/utils";
import type { loadTraceDetail } from "@/lib/tracing";

const STATUS_STYLE = {
  completed: { label: "Completed", tone: "bg-success-soft text-success", dot: "bg-success" },
  refusal: { label: "Refusal relayed", tone: "bg-warn-soft text-warn", dot: "bg-warn" },
  error: { label: "Error", tone: "bg-danger/10 text-danger", dot: "bg-danger" },
  running: { label: "Running", tone: "bg-accent-soft text-accent", dot: "bg-accent" },
};

export function DetailHead({ trace }: { trace: NonNullable<Awaited<ReturnType<typeof loadTraceDetail>>>["trace"] }) {
  const status = STATUS_STYLE[trace.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.completed;
  const chips = [
    trace.model,
    `chat #${trace.chatId}`,
    trace.totalTokens != null ? `${trace.totalTokens.toLocaleString()} tokens` : null,
    trace.durationMs != null ? `${(trace.durationMs / 1000).toFixed(1)}s total` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-text-primary">{trace.chatTitle ?? trace.chatId}</span>
        <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", status.tone)}>
          <span className={cn("h-[7px] w-[7px] rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip} className="rounded-md bg-bg-subtle px-2.5 py-1 font-mono text-xs text-text-secondary">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
