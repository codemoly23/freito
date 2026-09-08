import "server-only";
import { DateTime } from "luxon";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  timezone: string;
  startDate: Date;
  endDate?: Date | null;
};

// Every stored recurrence date (startDate/endDate/nextRunAt/lastRunAt) is the
// UTC instant equivalent to local midnight of some calendar date in the
// recurrence's own timezone. This makes "is this due" a plain `<= now`
// comparison while staying timezone-correct across DST/offset changes.

function toZonedMidnight(instant: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timezone).startOf("day");
}

/** Converts a plain `YYYY-MM-DD` calendar date (e.g. from a date input) into its stored occurrence instant. */
export function calendarDateToOccurrenceInstant(isoDate: string, timezone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return DateTime.fromObject({ year, month, day }, { zone: timezone }).startOf("day").toUTC().toJSDate();
}

/**
 * Advances one occurrence forward per the rule, respecting month-end
 * clamping (e.g. a rule anchored on day 31 lands on Feb 28/29 in short
 * months) and the leap-year-correct `daysInMonth`. Returns null once the
 * next occurrence would fall after `endDate` (the recurrence is finished).
 */
export function computeNextOccurrenceInstant(rule: RecurrenceRule, currentInstant: Date): Date | null {
  const current = toZonedMidnight(currentInstant, rule.timezone);
  let next: DateTime;
  if (rule.frequency === "DAILY") {
    next = current.plus({ days: rule.interval });
  } else if (rule.frequency === "WEEKLY") {
    next = current.plus({ weeks: rule.interval });
  } else {
    const anchorDay = toZonedMidnight(rule.startDate, rule.timezone).day;
    const base = current.set({ day: 1 }).plus({ months: rule.interval });
    next = base.set({ day: Math.min(anchorDay, base.daysInMonth ?? anchorDay) });
  }
  next = next.startOf("day");

  if (rule.endDate) {
    const end = toZonedMidnight(rule.endDate, rule.timezone);
    if (next > end) return null;
  }
  return next.toUTC().toJSDate();
}

/** The occurrence's calendar date (YYYY-MM-DD) in the recurrence's timezone, for display/labels. */
export function occurrenceIsoDate(occurrenceInstant: Date, timezone: string): string {
  return toZonedMidnight(occurrenceInstant, timezone).toISODate()!;
}

/**
 * Generated task `dueDate`, following the same "noon, no explicit zone"
 * convention `saveTask` already uses for manually-entered due dates
 * (`lib/actions/tasks.ts`: `new Date(`${data.dueDate}T12:00:00`)`), so
 * recurrence-generated tasks display identically to manually created ones.
 */
export function taskDueDateFor(occurrenceInstant: Date, dueInDays: number, timezone: string): Date {
  const zoned = DateTime.fromJSDate(occurrenceInstant, { zone: "utc" }).setZone(timezone).plus({ days: dueInDays });
  return new Date(`${zoned.toISODate()}T12:00:00`);
}

export function isValidIanaTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}
