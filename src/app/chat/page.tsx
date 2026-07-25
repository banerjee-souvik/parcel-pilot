import { nanoid } from "nanoid";
import { ChatClient } from "@/components/chat/chat-client";

// A fresh chat id per page load, generated server-side and passed down as a prop so the client
// component hydrates with a stable value instead of generating its own (which would mismatch SSR).
export default function ChatPage() {
  const chatId = `c_${nanoid(12)}`;
  return <ChatClient chatId={chatId} />;
}
