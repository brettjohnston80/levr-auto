import "server-only";

/**
 * Converts "first of month, 00:01 America/Chicago" into the real UTC
 * instant it represents, correctly across DST -- no hardcoded offset.
 * Standard technique: build a naive UTC timestamp using the wall-clock
 * numbers directly, then ask Intl what wall-clock time that instant
 * actually renders as in the target zone, and correct by the difference
 * between what we wanted and what we got.
 *
 * Phase 1 only ever hand-computed this once, for one known date (September
 * 2026) -- everything in Phase 2 (the generation due-check, Approve, and
 * reminders) needs it for arbitrary months, hence a real function.
 */
export function scheduledPublishAt(scheduledMonth: string): Date {
  const [year, month, day] = scheduledMonth.split("-").map(Number);

  // Step 1: naive guess -- treat 00:01 on the 1st as if it were already UTC.
  const naiveUTC = Date.UTC(year, month - 1, day, 0, 1, 0);

  // Step 2: ask what wall-clock time that naive guess actually is in
  // America/Chicago.
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

/** Escalating reminder checkpoints, in days before the scheduled publish instant. */
export const REMINDER_THRESHOLDS_DAYS = [5, 2, 1, 0] as const;

/** How far ahead of a scheduled month the draft-generation cron starts trying. */
export const DRAFT_GENERATION_LEAD_DAYS = 7;
