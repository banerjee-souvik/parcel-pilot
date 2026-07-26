"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

const RETRY_SECONDS = 15;

export function RateLimitBanner({ onRetry }: { onRetry: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(RETRY_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onRetry();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  return (
    <div className="flex w-full items-center gap-2.5 rounded-xl border border-warn-border bg-warn-soft px-3 py-2.5">
      <Timer className="h-4 w-4 shrink-0 text-warn" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text-primary">High demand right now</span>
        <p className="text-xs leading-relaxed text-text-secondary">
          Retrying automatically in {secondsLeft}s. Your message is saved.
        </p>
      </div>
    </div>
  );
}
