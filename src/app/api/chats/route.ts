import * as services from "@/lib/domain/services";

// Backs the "previous chats" list. The client sends the ids its own localStorage has tracked
// (see chat-history.ts) — there's no server-side notion of "your" chats without auth, so the
// client's local list is the only source of "which ids to even ask about."
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);
  const chats = await services.loadChatSummaries(ids);
  return Response.json({ chats });
}
