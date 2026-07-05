export type BookingRules = {
  slotIntervalMinutes: number;
  defaultDurationMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maxBookingsPerDay: number;
  maxBookingsPerSlot: number;
  lookBusyEnabled: boolean;
  lookBusyPercent: number;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  slotIntervalMinutes: 30,
  defaultDurationMinutes: 30,
  minNoticeMinutes: 0,
  maxAdvanceDays: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  maxBookingsPerDay: 0,
  maxBookingsPerSlot: 1,
  lookBusyEnabled: false,
  lookBusyPercent: 0,
};

export type DurationUnit = "minutes" | "hours";
export type NoticeUnit = "minutes" | "hours" | "days" | "weeks";
export type RangeUnit = "days" | "weeks" | "months";

export function toMinutes(value: number, unit: DurationUnit | NoticeUnit): number {
  switch (unit) {
    case "minutes":
      return value;
    case "hours":
      return value * 60;
    case "days":
      return value * 24 * 60;
    case "weeks":
      return value * 7 * 24 * 60;
    default:
      return value;
  }
}

export function toDays(value: number, unit: RangeUnit): number {
  switch (unit) {
    case "days":
      return value;
    case "weeks":
      return value * 7;
    case "months":
      return value * 30;
    default:
      return value;
  }
}

export function fromMinutes(totalMinutes: number, units: DurationUnit[]): {
  value: number;
  unit: DurationUnit;
} {
  for (const unit of units) {
    if (unit === "hours" && totalMinutes % 60 === 0 && totalMinutes >= 60) {
      return { value: totalMinutes / 60, unit: "hours" };
    }
  }
  return { value: totalMinutes, unit: "minutes" };
}

export function fromNoticeMinutes(totalMinutes: number): {
  value: number;
  unit: NoticeUnit;
} {
  if (totalMinutes === 0) return { value: 0, unit: "minutes" };
  if (totalMinutes % (7 * 24 * 60) === 0) {
    return { value: totalMinutes / (7 * 24 * 60), unit: "weeks" };
  }
  if (totalMinutes % (24 * 60) === 0) {
    return { value: totalMinutes / (24 * 60), unit: "days" };
  }
  if (totalMinutes % 60 === 0 && totalMinutes >= 60) {
    return { value: totalMinutes / 60, unit: "hours" };
  }
  return { value: totalMinutes, unit: "minutes" };
}

export function fromAdvanceDays(totalDays: number): {
  value: number;
  unit: RangeUnit;
} {
  if (totalDays === 0) return { value: 0, unit: "days" };
  if (totalDays % 30 === 0 && totalDays >= 30) {
    return { value: totalDays / 30, unit: "months" };
  }
  if (totalDays % 7 === 0 && totalDays >= 7) {
    return { value: totalDays / 7, unit: "weeks" };
  }
  return { value: totalDays, unit: "days" };
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Last calendar day of the month after `dateStr`'s month (YYYY-MM-DD). */
export function lastDayOfNextCalendarMonth(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  const lastDay = new Date(year, month + 1, 0);
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
}

export function daysBetweenInclusive(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

export function hashSlotKey(dateStr: string, startTime: string): number {
  const input = `${dateStr}:${startTime}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}
