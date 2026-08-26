import "server-only";
import { chicagoTimeToUtc } from "@/lib/timezone";

export type Theme =
  | "spotlight_monday"
  | "ask_around_tuesday"
  | "customer_testimonial"
  | "throwback_thursday"
  | "deal_of_the_week"
  | "news_recap_saturday"
  | "sunday_question";

export const THEMES: Theme[] = [
  "spotlight_monday",
  "ask_around_tuesday",
  "customer_testimonial",
  "throwback_thursday",
  "deal_of_the_week",
  "news_recap_saturday",
  "sunday_question",
];

export type Platform = "x" | "linkedin" | "facebook" | "instagram";

const THEME_DAY_OFFSET: Record<Theme, number> = {
  spotlight_monday: 0,
  ask_around_tuesday: 1,
  customer_testimonial: 2,
  throwback_thursday: 3,
  deal_of_the_week: 4,
  news_recap_saturday: 5,
  sunday_question: 6,
};

const PLATFORM_TIME: Record<Platform, { hour: number; minute: number }> = {
  x: { hour: 8, minute: 30 },
  linkedin: { hour: 9, minute: 0 },
  facebook: { hour: 10, minute: 0 },
  instagram: { hour: 11, minute: 30 },
};

const WEEKEND_THEMES = new Set<Theme>(["news_recap_saturday", "sunday_question"]);

/**
 * Every platform actually scheduled for a given theme -- LinkedIn has no
 * weekend slot at all, so it's absent (not just empty) for the two weekend
 * themes. Anything that checks "has every applicable platform been
 * posted/approved" (see src/lib/social-posting.ts) must use this, never a
 * blind "all 4" check, or a weekend post could never reach 'published'.
 */
export function applicablePlatforms(theme: Theme): Platform[] {
  return WEEKEND_THEMES.has(theme) ? ["x", "facebook", "instagram"] : ["x", "linkedin", "facebook", "instagram"];
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/**
 * Real UTC instant for one platform's post on a given theme/week, or null
 * if that platform doesn't post this theme's day at all (LinkedIn on the
 * two weekend themes).
 */
export function socialPostScheduledAt(weekStart: string, theme: Theme, platform: Platform): Date | null {
  if (!applicablePlatforms(theme).includes(platform)) return null;
  const dateStr = addDaysToDateString(weekStart, THEME_DAY_OFFSET[theme]);
  const { hour, minute } = PLATFORM_TIME[platform];
  return chicagoTimeToUtc(dateStr, hour, minute);
}

/**
 * The Monday (America/Chicago calendar date) of the week containing `date`.
 * Day-of-week math is timezone-independent once the correct Y-M-D digits
 * are known, so this resolves the Chicago wall-clock date first, then
 * walks back to Monday using plain calendar arithmetic.
 */
export function weekStartFor(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;

  const [year, month, day] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

  return addDaysToDateString(dateStr, -daysSinceMonday);
}
