import type { AvailabilityRule, Booking } from "@prisma/client";
import { SLOT_INTERVAL_MINUTES } from "../constants";
import {
  getDayOfWeekForDate,
  todayInTimezone,
} from "./timezone";
import {
  getDaysInMonth,
  minutesToTime,
  parseTimeToMinutes,
} from "./time.server";

export type TimeSlot = { startTime: string; endTime: string };

type SlotInput = {
  dateStr: string;
  timeZone: string;
  durationMinutes: number;
  rules: AvailabilityRule[];
  bookings: Pick<Booking, "startTime" | "endTime">[];
  hoursOverride?: { startTime: string; endTime: string };
};

export function generateAvailableSlots(input: SlotInput): TimeSlot[] {
  const { dateStr, timeZone, durationMinutes, rules, bookings, hoursOverride } =
    input;
  const dayOfWeek = getDayOfWeekForDate(dateStr, timeZone);
  const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);

  if (!hoursOverride && !rule?.enabled) return [];

  const startMinutes = parseTimeToMinutes(
    hoursOverride?.startTime ?? rule!.startTime,
  );
  const endMinutes = parseTimeToMinutes(hoursOverride?.endTime ?? rule!.endTime);
  const bookedRanges = bookings.map((b) => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime),
  }));

  const slots: TimeSlot[] = [];

  for (
    let current = startMinutes;
    current + durationMinutes <= endMinutes;
    current += SLOT_INTERVAL_MINUTES
  ) {
    const slotEnd = current + durationMinutes;
    const overlaps = bookedRanges.some(
      (b) => current < b.end && slotEnd > b.start,
    );
    if (!overlaps) {
      slots.push({
        startTime: minutesToTime(current),
        endTime: minutesToTime(slotEnd),
      });
    }
  }

  return slots;
}

type MonthInput = {
  year: number;
  month: number;
  timeZone: string;
  durationMinutes: number;
  rules: AvailabilityRule[];
  bookings: Booking[];
  closedDates: Set<string>;
  specialHoursByDate?: Map<string, { startTime: string; endTime: string }>;
  minDate?: string;
};

export function getAvailableDatesInMonth(input: MonthInput) {
  const {
    year,
    month,
    timeZone,
    durationMinutes,
    rules,
    bookings,
    closedDates,
    specialHoursByDate,
    minDate,
  } = input;
  const allDays = getDaysInMonth(year, month);
  const availableDates: string[] = [];
  const unavailableDates: string[] = [];
  const closedDateList: string[] = [];

  for (const dateStr of allDays) {
    if (minDate && dateStr < minDate) {
      continue;
    }

    if (closedDates.has(dateStr)) {
      closedDateList.push(dateStr);
      unavailableDates.push(dateStr);
      continue;
    }

    const dayBookings = bookings.filter(
      (b) => b.bookingDate.toISOString().slice(0, 10) === dateStr,
    );
    const hoursOverride = specialHoursByDate?.get(dateStr);
    const slots = generateAvailableSlots({
      dateStr,
      timeZone,
      durationMinutes,
      rules,
      bookings: dayBookings,
      hoursOverride,
    });

    if (slots.length > 0) {
      availableDates.push(dateStr);
    } else {
      unavailableDates.push(dateStr);
    }
  }

  return { availableDates, unavailableDates, closedDates: closedDateList };
}
