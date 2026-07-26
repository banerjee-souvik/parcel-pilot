import * as services from "@/lib/domain/services";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chatId } = await params;

  const chat = await services.ensureChat(chatId);
  const rows = await services.loadMessages(chatId);
  const initialMessages = rows.map(services.toUIMessage);

  // If this chat has an active stream (server crashed or client disconnected mid-response), this
  // load should attempt to reattach — that's the signal for both useChat's `resume` flag and the
  // "Reconnected" pill, decided here rather than guessed client-side.
  const willResume = chat.activeStreamId != null;

  return <ChatClient chatId={chatId} initialMessages={initialMessages} willResume={willResume} />;
}
