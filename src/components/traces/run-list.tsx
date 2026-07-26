"use client";

import { ChevronRight, ListFilter } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { listTraces } from "@/lib/tracing";

const STATUS_DOT = { completed: "bg-success", refusal: "bg-warn", error: "bg-danger", running: "bg-accent" };

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// A client component so "which row is selected" can be read from the current URL via usePathname —
// a shared layout.tsx can't receive params for a nested [id] segment below its own position, so
// deriving selection there would always be undefined. See decisions.md for the write-up.
export function RunList({ runs }: { runs: Awaited<ReturnType<typeof listTraces>> }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-y-auto border-r border-border bg-bg">
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-xs font-semibold text-text-secondary">CONVERSATIONS</span>
        <ListFilter className="h-4 w-4 text-text-secondary" />
      </div>
      {runs.length === 0 && (
        <p className="px-4 py-6 text-sm text-text-secondary">No traced runs yet — send a message in the chat.</p>
      )}
      {runs.map((run) => {
        const isSelected = pathname === `/traces/${run.id}`;
        return (
          <Link
            key={run.id}
            href={`/traces/${run.id}`}
            className={cn(
              "flex items-center gap-2.5 border-b border-border px-4 py-3",
              isSelected ? "bg-accent-soft" : "bg-bg hover:bg-bg-subtle"
            )}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[run.status as keyof typeof STATUS_DOT] ?? "bg-text-secondary")} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("truncate text-[13px]", isSelected ? "font-semibold text-text-primary" : "font-medium text-text-primary")}>
                {run.chatTitle ?? run.chatId}
              </span>
              <span className="truncate text-xs text-text-secondary">
                {relativeTime(run.createdAt)} · {run.stepCount} steps · {((run.totalTokens ?? 0) / 1000).toFixed(1)}k tok
              </span>
            </div>
            <ChevronRight className="h-[15px] w-[15px] shrink-0 text-text-secondary" />
          </Link>
        );
      })}
    </div>
  );
}
