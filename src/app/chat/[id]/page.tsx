import * as services from "@/lib/domain/services";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chatId } = await params;

  // Deliberately read-only: no chat row exists until a real message is actually POSTed (that route
  // creates it via ensureChat). Creating it just from a page view — prefetch, a crawler, a bookmarked
  // link — would pollute the table with rows nobody ever used. A chat that doesn't exist yet has no
  // active stream and no messages, which is exactly the correct "brand new" initial state anyway.
  const chat = await services.loadChat(chatId);
  const rows = chat ? await services.loadMessages(chatId) : [];
  const initialMessages = rows.map(services.toUIMessage);

  // If this chat has an active stream (server crashed or client disconnected mid-response), this
  // load should attempt to reattach — that's the signal for both useChat's `resume` flag and the
  // "Reconnected" pill, decided here rather than guessed client-side.
  const willResume = chat?.activeStreamId != null;

  return <ChatClient chatId={chatId} initialMessages={initialMessages} willResume={willResume} />;
}
