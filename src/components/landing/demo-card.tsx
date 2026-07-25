"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// `icon` arrives pre-rendered (a JSX element built in the server-component parent), not a component
// reference — React Server Components can't serialize function/component values across the boundary,
// only already-rendered nodes or plain data.
export function DemoCard({
  trackingNumber,
  icon,
  tone,
  headline,
  description,
}: {
  trackingNumber: string;
  icon: React.ReactNode;
  tone: "warn" | "success" | "danger";
  headline: string;
  description: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl border border-border bg-bg p-[18px]">
      <div className="flex items-center justify-between">
        {icon}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(trackingNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-text-secondary hover:text-text-primary"
          aria-label={`Copy ${trackingNumber}`}
        >
          <Copy className="h-[15px] w-[15px]" />
        </button>
      </div>
      <span className="font-mono text-base font-semibold text-text-primary">{trackingNumber}</span>
      <span className={cn("text-[13px] font-semibold", TONE_TEXT[tone])}>
        {copied ? "Copied!" : headline}
      </span>
      <p className="text-[13px] leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

const TONE_TEXT = { warn: "text-warn", success: "text-success", danger: "text-danger" };
