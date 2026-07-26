import { RefreshCw } from "lucide-react";

export function ResumedPill() {
  return (
    <div className="flex w-full justify-center">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle px-3 py-1.5">
        <RefreshCw className="h-3 w-3 text-text-secondary" />
        <span className="text-xs text-text-secondary">Reconnected — picked up where you left off</span>
      </div>
    </div>
  );
}
