import "server-only";
import { chicagoTimeToUtc } from "@/lib/timezone";

/**
 * "First of month, 00:01 America/Chicago" as a real UTC instant, correctly
 * across DST. Thin wrapper over chicagoTimeToUtc (extracted to
 * src/lib/timezone.ts when the daily social content system needed the same
 * DST-correct conversion for its own per-platform scheduling) -- everything
 * in Phase 2 (the generation due-check, Approve, and reminders) needs this
 * for arbitrary months.
 */
export function scheduledPublishAt(scheduledMonth: string): Date {
  return chicagoTimeToUtc(scheduledMonth, 0, 1);
}

/** Escalating reminder checkpoints, in days before the scheduled publish instant. */
export const REMINDER_THRESHOLDS_DAYS = [5, 2, 1, 0] as const;

/** How far ahead of a scheduled month the draft-generation cron starts trying. */
export const DRAFT_GENERATION_LEAD_DAYS = 7;
