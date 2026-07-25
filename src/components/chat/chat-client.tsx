"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { ToolPart } from "./tool-part";
import { WelcomeState } from "./welcome-state";

export function ChatClient({ chatId }: { chatId: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, setMessages, status } = useChat({
    id: chatId,
    messages: [],
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { id, message: messages.at(-1) },
      }),
    }),
  });

  function send(text: string) {
    if (!text.trim()) return;
    sendMessage({ text });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleResolved(message: UIMessage) {
    setMessages((prev) => [...prev, message]);
  }

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-screen w-full max-w-md flex-col bg-bg">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeState onSuggestion={send} />
        ) : (
          <div className="flex flex-col gap-3.5 px-5 py-5">
            {messages.map((message) =>
              message.parts.map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <MessageBubble key={`${message.id}-${i}`} role={message.role === "user" ? "user" : "assistant"}>
                      <span className="whitespace-pre-wrap">{part.text}</span>
                    </MessageBubble>
                  );
                }
                return (
                  <ToolPart
                    key={`${message.id}-${i}`}
                    part={part}
                    index={i}
                    chatId={chatId}
                    onSendMessage={send}
                    onResolved={handleResolved}
                  />
                );
              })
            )}
            {isBusy && (
              <div className="w-full pr-10">
                <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-bg-subtle px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 border-t border-border bg-bg px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Parcel Pilot…"
          className="h-11 flex-1 rounded-full border border-border bg-bg-subtle px-4 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
          disabled={status !== "ready"}
        />
        <button
          type="submit"
          disabled={status !== "ready" || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
