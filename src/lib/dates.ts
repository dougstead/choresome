/**
 * Calendar-date helpers.
 *
 * Due dates in this app are calendar days (2026-09-25), not instants — "clean
 * the oven" is due on a day, not at a specific second. We represent them as
 * `CalendarDate` ({ year, month, day }) and only touch a household's IANA
 * timezone when converting a true instant (a CompletionEvent's completedAt)
 * into "which local day did this happen on". Once in CalendarDate form, all
 * arithmetic is plain integer math with no timezone or DST involved at all,
 * which is what makes the recurrence engine safe to reason about.
 *
 * CalendarDates are persisted as UTC-midnight `Date` values (via
 * calendarDateToUtcDate / utcDateToCalendarDate) purely as a storage
 * convention — the UTC offset carries no meaning and must never be read as
 * "the time this is due".
 */

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  const days = DAYS_IN_MONTH[month - 1];
  if (days === undefined) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  return days;
}

export function isValidCalendarDate(cd: CalendarDate): boolean {
  return (
    Number.isInteger(cd.year) &&
    cd.month >= 1 &&
    cd.month <= 12 &&
    cd.day >= 1 &&
    cd.day <= daysInMonth(cd.year, cd.month)
  );
}

/** Serial day number (arbitrary epoch) enabling cheap add/diff/compare. */
function toOrdinal(cd: CalendarDate): number {
  return Date.UTC(cd.year, cd.month - 1, cd.day) / 86_400_000;
}

function fromOrdinal(ordinal: number): CalendarDate {
  const d = new Date(ordinal * 86_400_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return toOrdinal(a) - toOrdinal(b);
}

export function isBefore(a: CalendarDate, b: CalendarDate): boolean {
  return compareCalendarDates(a, b) < 0;
}

export function isSameOrBefore(a: CalendarDate, b: CalendarDate): boolean {
  return compareCalendarDates(a, b) <= 0;
}

export function isAfter(a: CalendarDate, b: CalendarDate): boolean {
  return compareCalendarDates(a, b) > 0;
}

export function isSameCalendarDate(a: CalendarDate, b: CalendarDate): boolean {
  return compareCalendarDates(a, b) === 0;
}

/** Whole days between a and b (b - a). Negative if b is earlier. */
export function diffInDays(a: CalendarDate, b: CalendarDate): number {
  return toOrdinal(b) - toOrdinal(a);
}

export function addDays(cd: CalendarDate, amount: number): CalendarDate {
  return fromOrdinal(toOrdinal(cd) + amount);
}

export function addWeeks(cd: CalendarDate, amount: number): CalendarDate {
  return addDays(cd, amount * 7);
}

/** Adds calendar months, clamping the day into the target month (e.g. Jan 31 + 1mo = Feb 28/29). */
export function addMonths(cd: CalendarDate, amount: number): CalendarDate {
  const totalMonths = (cd.year * 12 + (cd.month - 1)) + amount;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const day = Math.min(cd.day, daysInMonth(year, month));
  return { year, month, day };
}

/** Adds calendar years, clamping Feb 29 -> Feb 28 in non-leap target years. */
export function addYears(cd: CalendarDate, amount: number): CalendarDate {
  return addMonths(cd, amount * 12);
}

export function weekdayOf(cd: CalendarDate): number {
  // 0 = Sunday .. 6 = Saturday, matching Date#getUTCDay().
  return new Date(Date.UTC(cd.year, cd.month - 1, cd.day)).getUTCDay();
}

/** Which day of `date` it is in `timeZone`, given a precise instant. */
export function instantToCalendarDate(instant: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Could not resolve ${type} for timezone ${timeZone}`);
    return Number(part.value);
  };
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Storage convention: UTC-midnight Date whose UTC fields ARE the calendar date. */
export function calendarDateToUtcDate(cd: CalendarDate): Date {
  return new Date(Date.UTC(cd.year, cd.month - 1, cd.day));
}

export function utcDateToCalendarDate(date: Date): CalendarDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function calendarDateToIsoDate(cd: CalendarDate): string {
  const mm = String(cd.month).padStart(2, "0");
  const dd = String(cd.day).padStart(2, "0");
  return `${cd.year}-${mm}-${dd}`;
}
