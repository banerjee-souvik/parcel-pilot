"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("offline", callback);
  window.addEventListener("online", callback);
  return () => {
    window.removeEventListener("offline", callback);
    window.removeEventListener("online", callback);
  };
}

export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false // server snapshot: assume online, avoids a SSR/hydration mismatch
  );
}

export function OfflineBanner() {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-bg-subtle px-3 py-2.5">
      <WifiOff className="h-4 w-4 shrink-0 text-text-secondary" />
      <span className="text-[13px] text-text-secondary">You&apos;re offline. Messages will send once you&apos;re back online.</span>
    </div>
  );
}
