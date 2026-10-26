"use client";

import { formatDate } from "@/lib/dashboard-format";

/**
 * A date and time in the customer's own time zone ("Oct 17, 3:15 PM"). Server
 * rendering would use the server's zone (UTC on Vercel), so the browser's
 * render replaces it.
 */
export function LocalDateTime({ iso }: { iso: string }) {
  return <time dateTime={iso} suppressHydrationWarning>{formatDate(iso)}</time>;
}
