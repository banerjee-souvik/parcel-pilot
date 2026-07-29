// Shared date formatting for anything a human (or the model, in prose) actually reads. Tool
// results keep the raw ISO string too (the timeline card still needs it for Intl formatting with
// the visitor's own locale expectations) — these are the pre-formatted companions so the model has
// a ready-made human string to copy instead of reciting or reformatting an ISO timestamp itself.
export function formatDisplayDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatDisplayDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
