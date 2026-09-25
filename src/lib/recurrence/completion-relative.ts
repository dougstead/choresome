import { addDays, addMonths, addWeeks, addYears, type CalendarDate } from "@/lib/dates";
import type { IntervalUnit } from "./types";

export function addInterval(from: CalendarDate, value: number, unit: IntervalUnit): CalendarDate {
  switch (unit) {
    case "days":
      return addDays(from, value);
    case "weeks":
      return addWeeks(from, value);
    case "months":
      return addMonths(from, value);
    case "years":
      return addYears(from, value);
  }
}
