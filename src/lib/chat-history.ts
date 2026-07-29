// This app has no auth, so "your previous chats" can only mean "chats this browser has actually
// used" — tracked client-side, not derived from the DB. Recorded on send, not on page view: a chat
// row itself only exists once a message is sent (see decisions.md #16), so recording on view would
// just produce entries loadChatSummaries silently drops until the DB catches up. Recording on send
// avoids that gap entirely.
const KEY = "parcel-pilot:chat-ids";
const MAX_TRACKED = 50;

export function recordChatVisit(chatId: string): void {
  if (typeof window === "undefined") return;
  const ids = getChatIds().filter((id) => id !== chatId);
  ids.unshift(chatId);
  localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_TRACKED)));
}

export function getChatIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
