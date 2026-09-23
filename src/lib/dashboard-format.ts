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
