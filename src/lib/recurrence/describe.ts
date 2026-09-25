import type { RecurrenceRule } from "./types";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function listWeekdays(weekdays: number[]): string {
  const names = [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]);
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Human-readable summary, e.g. "Every 60 days after completion" or "Every other Wednesday". */
export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.type === "COMPLETION_RELATIVE") {
    return `Every ${pluralize(rule.intervalValue, rule.intervalUnit.slice(0, -1))} after completion`;
  }

  const { pattern } = rule;
  if (pattern.pattern === "weekly") {
    const days = listWeekdays(pattern.weekdays);
    if (pattern.intervalWeeks === 1) return `Every ${days}`;
    if (pattern.intervalWeeks === 2) return `Every other ${days}`;
    return `Every ${pattern.intervalWeeks} weeks on ${days}`;
  }

  if (pattern.pattern === "monthly") {
    const suffix = ordinalSuffix(pattern.dayOfMonth);
    if (pattern.intervalMonths === 1) return `Monthly, on the ${pattern.dayOfMonth}${suffix}`;
    return `Every ${pattern.intervalMonths} months, on the ${pattern.dayOfMonth}${suffix}`;
  }

  // annual
  const monthName = MONTH_NAMES[pattern.month - 1];
  return `Every year on ${monthName} ${pattern.day}`;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
