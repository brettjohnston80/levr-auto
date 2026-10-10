// The 24h self-edit window after finalizing (finalized_at + 24h), shared by
// /account and Your Car so their countdowns can't disagree.
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Window closed";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m left to edit`;
}
