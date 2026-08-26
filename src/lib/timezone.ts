import "server-only";

/**
 * Converts a wall-clock date + time in America/Chicago into the real UTC
 * instant it represents, correctly across DST -- no hardcoded offset.
 * Standard technique: build a naive UTC timestamp using the wall-clock
 * numbers directly, then ask Intl what wall-clock time that instant
 * actually renders as in the target zone, and correct by the difference.
 *
 * Extracted from article-schedule.ts (Articles Phase 2) so the daily
 * social content system's scheduling reuses the exact same verified logic
 * instead of a second copy -- both scheduledPublishAt (articles) and
 * socialPostScheduledAt (social posts) are now thin callers of this.
 */
export function chicagoTimeToUtc(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  // Step 1: naive guess -- treat the target wall-clock time as if it were already UTC.
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Step 2: ask what wall-clock time that naive guess actually is in America/Chicago.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(naiveUTC)).map((part) => [part.type, part.value])
  ) as Record<string, string>;

  const renderedAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  // Step 3: the difference between what we wanted (naiveUTC, interpreted as
  // wall-clock numbers) and what we actually got back (renderedAsUTC) is
  // exactly the correction needed -- add it back to the naive guess.
  const correction = naiveUTC - renderedAsUTC;
  return new Date(naiveUTC + correction);
}
