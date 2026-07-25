"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

// Day 1 scope: plain streaming, no resumption yet (that lands with Redis wiring later) and no
// structured tool-result cards yet (timeline/confirm cards land with Day 2's UX pass). This proves
// the agent loop end-to-end: persistence, guardrails, tracing, streaming.
export function ChatClient({ chatId }: { chatId: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    id: chatId,
    messages: [],
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { id, message: messages.at(-1) },
      }),
    }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <h1 className="mb-4 text-lg font-semibold">Parcel Pilot</h1>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                message.role === "user"
                  ? "inline-block rounded-lg bg-indigo-600 px-3 py-2 text-white"
                  : "inline-block rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <span key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                ) : part.type.startsWith("tool-") ? (
                  <pre key={i} className="mt-1 max-w-md overflow-x-auto rounded bg-black/10 p-2 text-xs">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                ) : null
              )}
            </div>
          </div>
        ))}
        {status === "submitted" && <p className="text-sm text-zinc-500">Thinking…</p>}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Parcel Pilot…"
          className="flex-1 rounded-full border border-zinc-300 px-4 py-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
          disabled={status !== "ready"}
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          className="rounded-full bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
