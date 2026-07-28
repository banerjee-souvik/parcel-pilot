"use client";

import { BrainCircuit, ChevronDown, ShieldCheck, Wrench, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { loadTraceDetail } from "@/lib/tracing";

type Span = NonNullable<Awaited<ReturnType<typeof loadTraceDetail>>>["spans"][number];

const OUTCOME_CHIP: Record<string, { label: string; tone: string }> = {
  ok: { label: "ok", tone: "bg-success-soft text-success" },
  refused: { label: "refused", tone: "bg-warn-soft text-warn" },
  proposal: { label: "proposal", tone: "bg-accent-soft text-accent" },
  executed: { label: "executed", tone: "bg-success-soft text-success" },
  cancelled: { label: "cancelled", tone: "bg-bg-subtle text-text-secondary" },
  error: { label: "error", tone: "bg-danger/10 text-danger" },
};

function stepIcon(span: Span): { Icon: LucideIcon; color: string } {
  if (span.kind === "model_call") return { Icon: BrainCircuit, color: "text-accent" };
  if (span.kind === "guardrail") return { Icon: ShieldCheck, color: "text-warn" };
  if (span.name === "executeProposal" || span.name === "cancelProposal") {
    return { Icon: Zap, color: span.outcome === "executed" ? "text-success" : "text-text-secondary" };
  }
  return { Icon: Wrench, color: "text-text-primary" };
}

function formatDetail(span: Span): string {
  if (span.kind === "model_call") {
    const output = span.output as { finishReason?: string } | null;
    return output?.finishReason ? `finishReason: ${output.finishReason}` : "";
  }
  const payload = span.output ?? span.input;
  if (payload == null) return "";
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function prettyJson(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function StepTree({ spans }: { spans: Span[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (spans.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-center text-sm text-text-secondary">
        No steps recorded for this run.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg">
      {spans.map((span, i) => {
        const { Icon, color } = stepIcon(span);
        const chip = OUTCOME_CHIP[span.outcome ?? "ok"] ?? OUTCOME_CHIP.ok;
        const nested = span.kind !== "model_call";
        const detail = formatDetail(span);
        const isExpanded = expandedId === span.id;
        const input = prettyJson(span.input);
        const output = prettyJson(span.output);
        const canExpand = Boolean(input || output);

        return (
          <div key={span.id} className={cn(i < spans.length - 1 && "border-b border-border")}>
            <button
              type="button"
              disabled={!canExpand}
              onClick={() => canExpand && setExpandedId(isExpanded ? null : span.id)}
              aria-expanded={isExpanded}
              className={cn(
                "flex w-full items-center gap-3 py-3 pr-4.5 text-left",
                nested ? "pl-[46px]" : "pl-[18px]",
                canExpand && "hover:bg-bg-subtle"
              )}
            >
              <Icon className={cn("h-[17px] w-[17px] shrink-0", color)} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-text-primary">{span.name}</span>
                {detail && <span className="truncate font-mono text-xs text-text-secondary">{detail}</span>}
              </div>
              <span className="shrink-0 font-mono text-xs text-text-secondary">{formatDuration(span.durationMs)}</span>
              <span className={cn("shrink-0 rounded-md px-2.5 py-0.5 text-[11px] font-semibold", chip.tone)}>{chip.label}</span>
              {canExpand && (
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-text-secondary transition-transform", isExpanded && "rotate-180")}
                />
              )}
            </button>
            {isExpanded && (
              <div className={cn("flex flex-col gap-2 pb-3.5 pr-4.5", nested ? "pl-[46px]" : "pl-[18px]")}>
                {input && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Input</span>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-bg-subtle p-2.5 font-mono text-xs text-text-primary">
                      {input}
                    </pre>
                  </div>
                )}
                {output && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Output</span>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-bg-subtle p-2.5 font-mono text-xs text-text-primary">
                      {output}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
