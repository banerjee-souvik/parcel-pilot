"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import type { ProposalSummary } from "@/lib/domain/types";

type Status = "idle" | "pending" | "resolved" | "error";

export function ConfirmCard({
  chatId,
  proposal,
  onResolved,
}: {
  chatId: string;
  proposal: ProposalSummary;
  onResolved: (message: UIMessage) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function act(kind: "confirm" | "cancel") {
    if (status === "pending" || status === "resolved") return;
    setStatus("pending");
    setErrorText(null);
    try {
      const res = await fetch(`/api/proposals/${proposal.proposalId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorText(body.result?.message ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("resolved");
      onResolved(body.message as UIMessage);
    } catch {
      setErrorText("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  const disabled = status === "pending" || status === "resolved";

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-accent bg-bg">
      <div className="flex items-center gap-2 bg-accent-soft px-3.5 py-3">
        <CalendarCheck className="h-[18px] w-[18px] text-accent" />
        <span className="text-sm font-semibold text-text-primary">{proposal.title}</span>
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-3">
        {proposal.rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4">
            <span className="text-[13px] text-text-secondary">{row.label}</span>
            <span className="text-right text-[13px] font-semibold text-text-primary">{row.value}</span>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-text-secondary">{proposal.note}</p>
        {errorText && <p className="text-xs font-medium text-danger">{errorText}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => act("cancel")}
            className="w-full rounded-[10px] border border-border bg-bg py-2.5 text-sm font-medium text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => act("confirm")}
            className={cn(
              "w-full rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-50",
              "bg-accent"
            )}
          >
            {status === "pending" ? "Confirming…" : "Confirm change"}
          </button>
        </div>
      </div>
    </div>
  );
}
