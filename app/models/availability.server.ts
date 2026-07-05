import prisma from "../db.server";
import type { DayOfWeek } from "@prisma/client";
import {
  formatDateString,
  parseDateString,
} from "../lib/booking/time.server";
import { buildStep3Subtitle } from "../lib/booking/working-hours-summary.server";
import {
  buildCalendarBounds,
  getEffectiveBookingRules,
  getMerchantBookingRules,
} from "../lib/booking/booking-rules.server";
import { hasPremiumAccess } from "./subscription.server";

export async function getAvailabilityRules(merchantId: string) {
  return prisma.availabilityRule.findMany({
    where: { merchantId },
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function upsertAvailabilityRules(
  merchantId: string,
  rules: Array<{
    dayOfWeek: DayOfWeek;
    enabled: boolean;
    startTime: string;
    endTime: string;
  }>,
) {
  return prisma.$transaction(
    rules.map((rule) =>
      prisma.availabilityRule.upsert({
        where: {
          merchantId_dayOfWeek: {
            merchantId,
            dayOfWeek: rule.dayOfWeek,
          },
        },
        create: { merchantId, ...rule },
        update: rule,
      }),
    ),
  );
}

export async function listClosedDates(merchantId: string) {
  return prisma.closedDate.findMany({
    where: { merchantId },
    orderBy: [{ date: "asc" }, { endDate: "asc" }],
  });
}

export async function addClosedDateRange(
  merchantId: string,
  startDate: string,
  endDate: string,
  reason?: string,
  closedAllDay = true,
  startTime?: string,
  endTime?: string,
) {
  return prisma.closedDate.create({
    data: {
      merchantId,
      date: parseDateString(startDate),
      endDate: parseDateString(endDate),
      reason,
      closedAllDay,
      startTime: closedAllDay ? null : startTime,
      endTime: closedAllDay ? null : endTime,
    },
  });
}

export async function updateClosedDateRange(
  merchantId: string,
  closedDateId: string,
  startDate: string,
  endDate: string,
  reason?: string,
  closedAllDay = true,
  startTime?: string,
  endTime?: string,
) {
  return prisma.closedDate.update({
    where: { id: closedDateId, merchantId },
    data: {
      date: parseDateString(startDate),
      endDate: parseDateString(endDate),
      reason: reason ?? null,
      closedAllDay,
      startTime: closedAllDay ? null : startTime ?? null,
      endTime: closedAllDay ? null : endTime ?? null,
    },
  });
}

export async function removeClosedDate(
  merchantId: string,
  closedDateId: string,
) {
  return prisma.closedDate.delete({
    where: { id: closedDateId, merchantId },
  });
}

export async function isDateClosed(merchantId: string, date: Date) {
  const closed = await prisma.closedDate.findFirst({
    where: {
      merchantId,
      closedAllDay: true,
      date: { lte: date },
      endDate: { gte: date },
    },
  });
  return !!closed;
}

export async function getHolidayOverrideForDate(merchantId: string, date: Date) {
  return prisma.closedDate.findFirst({
    where: {
      merchantId,
      closedAllDay: false,
      date: { lte: date },
      endDate: { gte: date },
    },
  });
}

export async function removeClosedDates(
  merchantId: string,
  closedDateIds: string[],
) {
  return prisma.closedDate.deleteMany({
    where: { merchantId, id: { in: closedDateIds } },
  });
}

/** Expand stored ranges into individual YYYY-MM-DD strings within a month window. */
export function expandClosedRangesToDates(
  ranges: Array<{ date: Date; endDate: Date }>,
  windowStart: Date,
  windowEnd: Date,
): Set<string> {
  const closed = new Set<string>();
  for (const range of ranges) {
    const start = range.date > windowStart ? range.date : windowStart;
    const end = range.endDate < windowEnd ? range.endDate : windowEnd;
    const cursor = new Date(start);
    while (cursor <= end) {
      closed.add(formatDateString(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return closed;
}

export async function getClosedDateSetForRange(
  merchantId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  const ranges = await prisma.closedDate.findMany({
    where: {
      merchantId,
      closedAllDay: true,
      date: { lte: windowEnd },
      endDate: { gte: windowStart },
    },
  });
  return expandClosedRangesToDates(ranges, windowStart, windowEnd);
}

export async function getStorefrontConfig(
  merchantId: string,
  shop: string,
  locale = "en",
  admin?: {
    graphql: (
      query: string,
      options?: { variables?: Record<string, unknown> },
    ) => Promise<Response>;
  } | null,
  serviceId?: string,
) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true, widgetTheme: true, locale: true },
  });
  const [rules, closedDates] = await Promise.all([
    getAvailabilityRules(merchantId),
    hasPremiumAccess(merchantId).then((premium) =>
      premium ? listClosedDates(merchantId) : Promise.resolve([]),
    ),
  ]);

  const { resolveStorefrontWidgetSettings } = await import(
    "../lib/widget/storefront-config.server"
  );
  const appLocale = merchant?.locale ?? "en";
  const widgetTheme = merchant?.widgetTheme ?? "CLASSIC";

  const widgetSettings = await resolveStorefrontWidgetSettings(shop, merchantId, {
    locale: locale || appLocale,
    widgetTheme,
    admin,
  });

  const timezone = merchant?.timezone ?? "UTC";
  const bookingRules = serviceId
    ? await getEffectiveBookingRules(merchantId, serviceId)
    : await getMerchantBookingRules(merchantId);
  const calendarBounds = buildCalendarBounds(timezone, bookingRules, {
    openThroughNextMonth: bookingRules.openThroughNextMonth,
  });

  return {
    workingHoursSummary: buildStep3Subtitle(rules, closedDates),
    timezone,
    widgetTheme,
    widgetSettings,
    calendarBounds,
  };
}

export async function getClosedDatesInRange(
  merchantId: string,
  startDate: Date,
  endDate: Date,
) {
  return prisma.closedDate.findMany({
    where: {
      merchantId,
      date: { lte: endDate },
      endDate: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });
}
