import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

// /chat always starts a fresh conversation and hands off to /chat/[id], which is the durable,
// refreshable URL. Without this redirect, refreshing /chat would silently start a new chat every
// time — making stream resumption untestable, since there'd never be the same chatId twice.
export default function NewChatPage() {
  redirect(`/chat/c_${nanoid(12)}`);
}
