// Shared between /account and /account/deal so a price/date can't render
// differently on the two surfaces describing the same offer.

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "October 4, 2026" -- the same long form the Day-60 emails use. */
export function formatLongDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** A date-only value (YYYY-MM-DD) as "Oct 31", read as that calendar day wherever the viewer is. */
export function formatDayMonth(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
