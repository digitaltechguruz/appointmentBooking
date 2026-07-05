import type { AvailabilityRule, Booking } from "@prisma/client";
import type { BookingRules } from "./booking-rules.shared";
import { addDaysToDateString, hashSlotKey, lastDayOfNextCalendarMonth } from "./booking-rules.shared";
import {
  getDayOfWeekForDate,
  merchantLocalToUtc,
  todayInTimezone,
} from "./timezone";
import {
  formatDateString,
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
  bookingRules: BookingRules;
};

function isSlotWithinMinNotice(
  dateStr: string,
  startTime: string,
  timeZone: string,
  minNoticeMinutes: number,
): boolean {
  if (minNoticeMinutes <= 0) return true;
  const slotInstant = merchantLocalToUtc(dateStr, startTime, timeZone);
  const earliest = new Date(Date.now() + minNoticeMinutes * 60 * 1000);
  return slotInstant >= earliest;
}

type BookingRulesWithAdvance = BookingRules & { openThroughNextMonth?: boolean };

function isWithinMaxAdvance(
  dateStr: string,
  timeZone: string,
  bookingRules: BookingRulesWithAdvance,
): boolean {
  const today = todayInTimezone(timeZone);
  if (bookingRules.openThroughNextMonth) {
    const maxDate = lastDayOfNextCalendarMonth(today);
    return dateStr >= today && dateStr <= maxDate;
  }
  if (bookingRules.maxAdvanceDays <= 0) return true;
  const maxDate = addDaysToDateString(today, bookingRules.maxAdvanceDays);
  return dateStr <= maxDate;
}

function applyLookBusy(
  slots: TimeSlot[],
  dateStr: string,
  bookingRules: BookingRules,
): TimeSlot[] {
  if (!bookingRules.lookBusyEnabled || bookingRules.lookBusyPercent <= 0) {
    return slots;
  }
  const percent = Math.min(100, Math.max(0, bookingRules.lookBusyPercent));
  return slots.filter(
    (slot) => hashSlotKey(dateStr, slot.startTime) >= percent,
  );
}

export function generateAvailableSlots(input: SlotInput): TimeSlot[] {
  const {
    dateStr,
    timeZone,
    durationMinutes,
    rules,
    bookings,
    hoursOverride,
    bookingRules,
  } = input;

  if (!isWithinMaxAdvance(dateStr, timeZone, bookingRules)) {
    return [];
  }

  if (
    bookingRules.maxBookingsPerDay > 0 &&
    bookings.length >= bookingRules.maxBookingsPerDay
  ) {
    return [];
  }

  const dayOfWeek = getDayOfWeekForDate(dateStr, timeZone);
  const rule = rules.find((r) => r.dayOfWeek === dayOfWeek);

  if (!hoursOverride && !rule?.enabled) return [];

  const startMinutes = parseTimeToMinutes(
    hoursOverride?.startTime ?? rule!.startTime,
  );
  const endMinutes = parseTimeToMinutes(hoursOverride?.endTime ?? rule!.endTime);

  const slotInterval = Math.max(5, bookingRules.slotIntervalMinutes);
  const bufferBefore = Math.max(0, bookingRules.bufferBeforeMinutes);
  const bufferAfter = Math.max(0, bookingRules.bufferAfterMinutes);
  const maxPerSlot = Math.max(1, bookingRules.maxBookingsPerSlot);

  const slots: TimeSlot[] = [];

  for (
    let current = startMinutes;
    current + durationMinutes <= endMinutes;
    current += slotInterval
  ) {
    const startTime = minutesToTime(current);
    const slotEnd = current + durationMinutes;

    if (
      !isSlotWithinMinNotice(
        dateStr,
        startTime,
        timeZone,
        bookingRules.minNoticeMinutes,
      )
    ) {
      continue;
    }

    const sameSlotCount = bookings.filter((b) => b.startTime === startTime).length;
    if (sameSlotCount >= maxPerSlot) {
      continue;
    }

    const overlaps = bookings.some((booking) => {
      if (booking.startTime === startTime) return false;
      const bookedStart = parseTimeToMinutes(booking.startTime);
      const bookedEnd = parseTimeToMinutes(booking.endTime);
      const blockedStart = bookedStart - bufferBefore;
      const blockedEnd = bookedEnd + bufferAfter;
      return current < blockedEnd && slotEnd > blockedStart;
    });

    if (!overlaps) {
      slots.push({
        startTime,
        endTime: minutesToTime(slotEnd),
      });
    }
  }

  return applyLookBusy(slots, dateStr, bookingRules);
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
  bookingRules: BookingRules;
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
    bookingRules,
  } = input;
  const allDays = getDaysInMonth(year, month);
  const availableDates: string[] = [];
  const unavailableDates: string[] = [];
  const closedDateList: string[] = [];

  const today = todayInTimezone(timeZone);
  const maxDate = bookingRules.openThroughNextMonth
    ? lastDayOfNextCalendarMonth(today)
    : bookingRules.maxAdvanceDays > 0
      ? addDaysToDateString(today, bookingRules.maxAdvanceDays)
      : undefined;

  for (const dateStr of allDays) {
    if (minDate && dateStr < minDate) {
      continue;
    }

    if (maxDate && dateStr > maxDate) {
      continue;
    }

    if (closedDates.has(dateStr)) {
      closedDateList.push(dateStr);
      unavailableDates.push(dateStr);
      continue;
    }

    const dayBookings = bookings.filter(
      (b) => formatDateString(b.bookingDate) === dateStr,
    );
    const hoursOverride = specialHoursByDate?.get(dateStr);
    const slots = generateAvailableSlots({
      dateStr,
      timeZone,
      durationMinutes,
      rules,
      bookings: dayBookings,
      hoursOverride,
      bookingRules,
    });

    if (slots.length > 0) {
      availableDates.push(dateStr);
    } else {
      unavailableDates.push(dateStr);
    }
  }

  return { availableDates, unavailableDates, closedDates: closedDateList };
}
