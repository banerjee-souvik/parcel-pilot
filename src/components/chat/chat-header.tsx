import { Package } from "lucide-react";
import { ChatMenu } from "./chat-menu";

export function ChatHeader({ onSend }: { onSend: (text: string) => void }) {
  return (
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
      <ChatMenu onSend={onSend} />
    </div>
  );
}
