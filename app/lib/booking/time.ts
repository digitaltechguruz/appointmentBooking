import type { DayOfWeek } from "@prisma/client";

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(parseTimeToMinutes(time) + minutes);
}

/** Earliest valid close time strictly after openTime (15-minute steps). */
export function minCloseTimeAfter(openTime: string): string {
  const minM = parseTimeToMinutes(openTime);
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const total = hour * 60 + minute;
      if (total > minM) {
        return minutesToTime(total);
      }
    }
  }
  return "23:45";
}

export function getDayOfWeek(date: Date): DayOfWeek {
  return JS_DAY_TO_ENUM[date.getUTCDay()];
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (date.getUTCMonth() === month - 1) {
    days.push(formatDateString(date));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}
