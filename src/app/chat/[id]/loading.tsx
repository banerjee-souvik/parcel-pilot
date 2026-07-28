import { Package } from "lucide-react";

// Shown instantly on navigation while ChatPage's loadChat()/loadMessages() DB reads resolve —
// without this, "Open chat" is a blank screen for however long that read takes. Mirrors ChatClient's
// actual shell (header + input bar) so there's no layout jump once the real page mounts.
export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-screen w-full max-w-md flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-bg px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-text-primary">Parcel Pilot</span>
            <div className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-success" />
              <span className="text-xs text-text-secondary">SwiftShip support agent</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-bg-subtle px-3.5 py-2.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" />
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border bg-bg px-4 py-3">
        <div className="h-11 flex-1 animate-pulse rounded-full bg-bg-subtle" />
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-bg-subtle" />
      </div>
    </div>
  );
}
