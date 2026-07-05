import prisma from "../../db.server";
import {
  DEFAULT_BOOKING_RULES,
  addDaysToDateString,
  daysBetweenInclusive,
  fromAdvanceDays,
  lastDayOfNextCalendarMonth,
  type BookingRules,
} from "./booking-rules.shared";
import { todayInTimezone } from "./timezone";

const bookingRulesSelect = {
  slotIntervalMinutes: true,
  defaultDurationMinutes: true,
  minNoticeMinutes: true,
  maxAdvanceDays: true,
  bufferBeforeMinutes: true,
  bufferAfterMinutes: true,
  maxBookingsPerDay: true,
  maxBookingsPerSlot: true,
  lookBusyEnabled: true,
  lookBusyPercent: true,
  timezone: true,
} as const;

const serviceBookingRulesSelect = {
  useCustomBookingRules: true,
  durationMinutes: true,
  slotIntervalMinutes: true,
  minNoticeMinutes: true,
  maxAdvanceDays: true,
  bufferBeforeMinutes: true,
  bufferAfterMinutes: true,
  maxBookingsPerDay: true,
  maxBookingsPerSlot: true,
  lookBusyEnabled: true,
  lookBusyPercent: true,
} as const;

export type CalendarBounds = {
  minMonth: string;
  maxMonth: string | null;
  maxAdvanceDays: number;
  maxAdvanceLabel: string | null;
};

function normalizeBookingRules(rules: BookingRules): BookingRules {
  return {
    ...rules,
    maxBookingsPerSlot: Math.max(1, rules.maxBookingsPerSlot),
    lookBusyPercent: Math.min(100, Math.max(0, rules.lookBusyPercent)),
  };
}

export function buildCalendarBounds(
  timeZone: string,
  bookingRules: BookingRules,
  options?: { openThroughNextMonth?: boolean },
): CalendarBounds {
  const today = todayInTimezone(timeZone);
  const minMonth = today.slice(0, 7);
  let maxMonth: string | null = null;
  let maxAdvanceLabel: string | null = null;
  let maxAdvanceDays = bookingRules.maxAdvanceDays;

  if (options?.openThroughNextMonth) {
    const maxDate = lastDayOfNextCalendarMonth(today);
    maxMonth = maxDate.slice(0, 7);
    maxAdvanceDays = daysBetweenInclusive(today, maxDate);
    maxAdvanceLabel = null;
  } else if (maxAdvanceDays > 0) {
    const maxDate = addDaysToDateString(today, maxAdvanceDays);
    maxMonth = maxDate.slice(0, 7);
    const advance = fromAdvanceDays(maxAdvanceDays);
    const unitWord =
      advance.unit === "months"
        ? advance.value === 1
          ? "month"
          : "months"
        : advance.unit === "weeks"
          ? advance.value === 1
            ? "week"
            : "weeks"
          : advance.value === 1
            ? "day"
            : "days";
    maxAdvanceLabel = `${advance.value} ${unitWord}`;
  } else {
    const fallbackMax = addDaysToDateString(today, 365);
    maxMonth = fallbackMax.slice(0, 7);
  }

  return {
    minMonth,
    maxMonth,
    maxAdvanceDays,
    maxAdvanceLabel,
  };
}

export async function getMerchantBookingRules(
  merchantId: string,
): Promise<BookingRules> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: bookingRulesSelect,
  });

  if (!merchant) {
    return { ...DEFAULT_BOOKING_RULES };
  }

  return normalizeBookingRules({
    slotIntervalMinutes: merchant.slotIntervalMinutes,
    defaultDurationMinutes: merchant.defaultDurationMinutes,
    minNoticeMinutes: merchant.minNoticeMinutes,
    maxAdvanceDays: merchant.maxAdvanceDays,
    bufferBeforeMinutes: merchant.bufferBeforeMinutes,
    bufferAfterMinutes: merchant.bufferAfterMinutes,
    maxBookingsPerDay: merchant.maxBookingsPerDay,
    maxBookingsPerSlot: merchant.maxBookingsPerSlot,
    lookBusyEnabled: merchant.lookBusyEnabled,
    lookBusyPercent: merchant.lookBusyPercent,
  });
}

export async function getEffectiveBookingRules(
  merchantId: string,
  serviceId: string,
): Promise<BookingRules & { openThroughNextMonth?: boolean }> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: bookingRulesSelect,
  });

  if (!merchant) {
    return { ...DEFAULT_BOOKING_RULES };
  }

  const merchantRules = normalizeBookingRules({
    slotIntervalMinutes: merchant.slotIntervalMinutes,
    defaultDurationMinutes: merchant.defaultDurationMinutes,
    minNoticeMinutes: merchant.minNoticeMinutes,
    maxAdvanceDays: merchant.maxAdvanceDays,
    bufferBeforeMinutes: merchant.bufferBeforeMinutes,
    bufferAfterMinutes: merchant.bufferAfterMinutes,
    maxBookingsPerDay: merchant.maxBookingsPerDay,
    maxBookingsPerSlot: merchant.maxBookingsPerSlot,
    lookBusyEnabled: merchant.lookBusyEnabled,
    lookBusyPercent: merchant.lookBusyPercent,
  });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, merchantId },
    select: serviceBookingRulesSelect,
  });

  if (!service) {
    return merchantRules;
  }

  if (!service.useCustomBookingRules) {
    return normalizeBookingRules({
      ...merchantRules,
      defaultDurationMinutes: service.durationMinutes,
    });
  }

  const openThroughNextMonth = service.maxAdvanceDays == null;

  return {
    ...normalizeBookingRules({
      slotIntervalMinutes:
        service.slotIntervalMinutes ?? service.durationMinutes,
      defaultDurationMinutes: service.durationMinutes,
      minNoticeMinutes: service.minNoticeMinutes ?? 0,
      maxAdvanceDays: service.maxAdvanceDays ?? 0,
      bufferBeforeMinutes: service.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: service.bufferAfterMinutes ?? 0,
      maxBookingsPerDay: service.maxBookingsPerDay ?? 0,
      maxBookingsPerSlot: service.maxBookingsPerSlot ?? 1,
      lookBusyEnabled: service.lookBusyEnabled ?? false,
      lookBusyPercent: service.lookBusyPercent ?? 0,
    }),
    openThroughNextMonth,
  };
}

export async function updateMerchantBookingRules(
  merchantId: string,
  rules: BookingRules,
) {
  const normalized = normalizeBookingRules(rules);
  return prisma.merchant.update({
    where: { id: merchantId },
    data: {
      slotIntervalMinutes: normalized.slotIntervalMinutes,
      defaultDurationMinutes: normalized.defaultDurationMinutes,
      minNoticeMinutes: normalized.minNoticeMinutes,
      maxAdvanceDays: normalized.maxAdvanceDays,
      bufferBeforeMinutes: normalized.bufferBeforeMinutes,
      bufferAfterMinutes: normalized.bufferAfterMinutes,
      maxBookingsPerDay: normalized.maxBookingsPerDay,
      maxBookingsPerSlot: normalized.maxBookingsPerSlot,
      lookBusyEnabled: normalized.lookBusyEnabled,
      lookBusyPercent: normalized.lookBusyPercent,
    },
  });
}

export type ServiceBookingRulesInput = {
  useCustomBookingRules: boolean;
  slotIntervalMinutes?: number | null;
  minNoticeMinutes?: number | null;
  maxAdvanceDays?: number | null;
  bufferBeforeMinutes?: number | null;
  bufferAfterMinutes?: number | null;
  maxBookingsPerDay?: number | null;
  maxBookingsPerSlot?: number | null;
  lookBusyEnabled?: boolean | null;
  lookBusyPercent?: number | null;
};

export function bookingRulesToServiceInput(
  rules: BookingRules,
  useCustom: boolean,
): ServiceBookingRulesInput {
  if (!useCustom) {
    return { useCustomBookingRules: false };
  }

  const normalized = normalizeBookingRules(rules);
  return {
    useCustomBookingRules: true,
    slotIntervalMinutes: normalized.slotIntervalMinutes,
    minNoticeMinutes: normalized.minNoticeMinutes,
    maxAdvanceDays: normalized.maxAdvanceDays,
    bufferBeforeMinutes: normalized.bufferBeforeMinutes,
    bufferAfterMinutes: normalized.bufferAfterMinutes,
    maxBookingsPerDay: normalized.maxBookingsPerDay,
    maxBookingsPerSlot: normalized.maxBookingsPerSlot,
    lookBusyEnabled: normalized.lookBusyEnabled,
    lookBusyPercent: normalized.lookBusyPercent,
  };
}
