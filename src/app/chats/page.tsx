"use client";

import { MessageCircle, MessagesSquare, Package, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getChatIds } from "@/lib/chat-history";
import { formatRelativeTime } from "@/lib/format";

type ChatSummary = {
  id: string;
  scopedTrackingNumber: string | null;
  lastMessageAt: string;
  preview: string;
};

export default function ChatsPage() {
  // Read once at mount, not in the effect — localStorage is external state React doesn't own, and
  // it's only ever written by recordChatVisit elsewhere, never by this page.
  const [ids] = useState(getChatIds);
  const [chats, setChats] = useState<ChatSummary[] | null>(ids.length === 0 ? [] : null);

  useEffect(() => {
    if (ids.length === 0) return;
    fetch(`/api/chats?ids=${ids.map(encodeURIComponent).join(",")}`)
      .then((res) => res.json())
      .then((data: { chats: ChatSummary[] }) => {
        // Preserve this browser's most-recently-used order rather than the server's own sort —
        // getChatIds() is already newest-first from recordChatVisit, and that's the more meaningful
        // order here than "last message in the DB," which could differ if a chat was resumed elsewhere.
        const byId = new Map(data.chats.map((c) => [c.id, c]));
        setChats(ids.map((id) => byId.get(id)).filter((c): c is ChatSummary => c != null));
      })
      .catch(() => setChats([]));
  }, [ids]);

  return (
    <div className="mx-auto flex h-screen w-full max-w-md flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-bg px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
            <MessagesSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-text-primary">Previous chats</span>
        </div>
        <Link
          href="/chat"
          prefetch={false}
          aria-label="New conversation"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-subtle"
        >
          <SquarePen className="h-[18px] w-[18px]" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats === null && (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-bg-subtle" />
            ))}
          </div>
        )}

        {chats?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <MessageCircle className="h-8 w-8 text-text-secondary" />
            <p className="text-sm text-text-secondary">
              No conversations on this device yet. Chats you send a message in will show up here.
            </p>
            <Link href="/chat" prefetch={false} className="rounded-[10px] bg-accent px-5 py-2.5 text-sm font-semibold text-white">
              Start a conversation
            </Link>
          </div>
        )}

        {chats && chats.length > 0 && (
          <div className="flex flex-col">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-start gap-3 border-b border-border px-5 py-3.5 hover:bg-bg-subtle"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle">
                  <Package className="h-4 w-4 text-text-secondary" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {chat.scopedTrackingNumber ?? "New conversation"}
                    </span>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {formatRelativeTime(new Date(chat.lastMessageAt))}
                    </span>
                  </div>
                  <p className="truncate text-xs text-text-secondary">{chat.preview || "No messages yet"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
