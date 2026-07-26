"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { OfflineBanner, useIsOffline } from "./offline-banner";
import { RateLimitBanner } from "./rate-limit-banner";
import { ResumedPill } from "./resumed-pill";
import { ToolPart } from "./tool-part";
import { WelcomeState } from "./welcome-state";

function parseErrorCode(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    return (JSON.parse(error.message) as { code?: string }).code ?? null;
  } catch {
    return null;
  }
}

export function ChatClient({
  chatId,
  initialMessages = [],
  willResume = false,
}: {
  chatId: string;
  initialMessages?: UIMessage[];
  willResume?: boolean;
}) {
  const [input, setInput] = useState("");
  const [pillDismissed, setPillDismissed] = useState(false);
  const isOffline = useIsOffline();

  const { messages, sendMessage, setMessages, status, error, clearError, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    resume: willResume,
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { id, message: messages.at(-1) },
      }),
    }),
  });

  // The pill announces a resumed reply; once that reply finishes (or the user sends something new),
  // it's noise. Derived directly from render-time state — no effect needed for a pure computation.
  const resumedReplyDone = status === "ready" && messages.some((m) => m.role === "assistant");
  const showResumedPill = willResume && !pillDismissed && !resumedReplyDone;

  function send(text: string) {
    if (!text.trim()) return;
    setPillDismissed(true);
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

  function retry() {
    clearError();
    regenerate();
  }

  const isBusy = status === "submitted" || status === "streaming";
  const errorCode = parseErrorCode(error);
  const canSend = status === "ready" && !isOffline;

  return (
    <div className="mx-auto flex h-screen w-full max-w-md flex-col bg-bg">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto">
        {showResumedPill && (
          <div className="px-5 pt-4">
            <ResumedPill />
          </div>
        )}

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
            {errorCode === "RATE_LIMITED" && <RateLimitBanner onRetry={retry} />}
            {errorCode === "UNKNOWN" && (
              <p className="text-xs font-medium text-danger">Something went wrong. Please try again.</p>
            )}
          </div>
        )}
      </div>

      {isOffline && (
        <div className="px-4 pb-2">
          <OfflineBanner />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 border-t border-border bg-bg px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Parcel Pilot…"
          className="h-11 flex-1 rounded-full border border-border bg-bg-subtle px-4 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
          disabled={!canSend}
        />
        <button
          type="submit"
          disabled={!canSend || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
