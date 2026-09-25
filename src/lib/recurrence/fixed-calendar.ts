import {
  addDays,
  addMonths,
  daysInMonth,
  diffInDays,
  isAfter,
  isSameOrBefore,
  weekdayOf,
  type CalendarDate,
} from "@/lib/dates";
import type { AnnualPattern, FixedCalendarPattern, MonthlyPattern, WeeklyPattern } from "./types";

function nonNegativeMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function startOfWeek(cd: CalendarDate): CalendarDate {
  return addDays(cd, -weekdayOf(cd));
}

function weeklyOccurrenceOn(cd: CalendarDate, pattern: WeeklyPattern): boolean {
  if (!pattern.weekdays.includes(weekdayOf(cd))) return false;
  const weeksSinceAnchor = Math.floor(diffInDays(startOfWeek(pattern.anchorDate), startOfWeek(cd)) / 7);
  return nonNegativeMod(weeksSinceAnchor, pattern.intervalWeeks) === 0;
}

function monthlyOccurrenceCandidateForMonth(year: number, month: number, pattern: MonthlyPattern): CalendarDate {
  const day = Math.min(pattern.dayOfMonth, daysInMonth(year, month));
  return { year, month, day };
}

function monthlyMonthIsIncluded(year: number, month: number, pattern: MonthlyPattern): boolean {
  const anchorIndex = pattern.anchorDate.year * 12 + (pattern.anchorDate.month - 1);
  const candidateIndex = year * 12 + (month - 1);
  return nonNegativeMod(candidateIndex - anchorIndex, pattern.intervalMonths) === 0;
}

function annualOccurrenceForYear(year: number, pattern: AnnualPattern): CalendarDate {
  const day = Math.min(pattern.day, daysInMonth(year, pattern.month));
  return { year, month: pattern.month, day };
}

/** Earliest occurrence of `pattern` satisfying `predicate(candidate)` (e.g. "after X"). Bounded to avoid infinite loops on malformed input. */
function findOccurrence(
  pattern: FixedCalendarPattern,
  from: CalendarDate,
  predicate: (candidate: CalendarDate) => boolean
): CalendarDate {
  if (pattern.pattern === "weekly") {
    const maxDays = 366 * (pattern.intervalWeeks + 1) + 7;
    let candidate = from;
    for (let i = 0; i < maxDays; i++) {
      if (predicate(candidate) && weeklyOccurrenceOn(candidate, pattern)) return candidate;
      candidate = addDays(candidate, 1);
    }
    throw new Error("Could not find a weekly occurrence within the search window");
  }

  if (pattern.pattern === "monthly") {
    const maxMonths = 12 * (pattern.intervalMonths + 1) + 12;
    let year = from.year;
    let month = from.month;
    for (let i = 0; i < maxMonths; i++) {
      if (monthlyMonthIsIncluded(year, month, pattern)) {
        const candidate = monthlyOccurrenceCandidateForMonth(year, month, pattern);
        if (predicate(candidate)) return candidate;
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    throw new Error("Could not find a monthly occurrence within the search window");
  }

  // annual
  for (let i = 0; i < 10; i++) {
    const candidate = annualOccurrenceForYear(from.year + i, pattern);
    if (predicate(candidate)) return candidate;
  }
  throw new Error("Could not find an annual occurrence within the search window");
}

export function nextFixedOccurrenceOnOrAfter(pattern: FixedCalendarPattern, from: CalendarDate): CalendarDate {
  return findOccurrence(pattern, from, (candidate) => isSameOrBefore(from, candidate));
}

export function nextFixedOccurrenceAfter(pattern: FixedCalendarPattern, from: CalendarDate): CalendarDate {
  return findOccurrence(pattern, from, (candidate) => isAfter(candidate, from));
}

// Re-exported for tests / callers that want month clamping behaviour directly.
export { addMonths };
