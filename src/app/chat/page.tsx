import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

// /chat always starts a fresh conversation and hands off to /chat/[id], which is the durable,
// refreshable URL. Without this redirect, refreshing /chat would silently start a new chat every
// time — making stream resumption untestable, since there'd never be the same chatId twice.
//
// force-dynamic is load-bearing here, not defensive: nanoid() alone doesn't stop Next from
// statically prerendering this page at build time (no request-time API is used) — without this
// export, `next build` bakes in a single redirect Location and every visitor in production gets
// funneled into the exact same chat id until the next deploy. Same class of bug as decisions.md #13.
export const dynamic = "force-dynamic";

export default function NewChatPage() {
  redirect(`/chat/c_${nanoid(12)}`);
}
