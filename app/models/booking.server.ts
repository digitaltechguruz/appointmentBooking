import prisma from "../db.server";
import type { BookingStatus } from "@prisma/client";
import { BILLING_PLANS } from "../lib/constants";
import { parseDateString, formatDateString } from "../lib/booking/time.server";
import { getService } from "./service.server";
import { getMeetingType, listMeetingTypesForService } from "./meeting-type.server";
import {
  getAvailabilityRules,
  isDateClosed,
  getClosedDateSetForRange,
  getHolidayOverrideForDate,
  getClosedDatesInRange,
} from "./availability.server";
import { findOrCreateCustomer } from "./customer.server";
import { getMerchantTimezone, ensureMerchantShopInfo } from "./merchant.server";
import { todayInTimezone } from "../lib/booking/timezone";
import {
  generateAvailableSlots,
  getAvailableDatesInMonth,
} from "../lib/booking/slots.server";
import {
  sendBookingNotificationEmails,
  type BookingEmailKind,
} from "../lib/email/send.server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getGoogleConnection,
} from "../lib/integrations/google/calendar.server";
import { createZoomMeeting, deleteZoomMeeting } from "../lib/integrations/zoom/meetings.server";
import { getIntegrationConnections } from "../lib/integrations/status.server";
import { meetingTypeHasVideoLink } from "../lib/constants";
import type { BookingWithRelations } from "../types/admin";

export function serializePublicBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    status: booking.status,
    date: booking.bookingDate.toISOString().slice(0, 10),
    startTime: booking.startTime,
    endTime: booking.endTime,
    service: booking.service.name,
    meetingType: booking.meetingType.name,
    zoomJoinUrl: booking.zoomJoinUrl,
    googleMeetUrl: booking.googleMeetUrl,
  };
}

async function getBookingEmailContext(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { shop: true, email: true, timezone: true, shopName: true },
  });
  if (!merchant) {
    return {
      merchantEmail: null,
      shopName: null,
      shopEmail: null,
      merchantTimezone: "UTC",
      googleCalendarConnected: false,
    };
  }

  const shopInfo = await ensureMerchantShopInfo(merchantId, merchant.shop);
  const googleConn = await getGoogleConnection(merchantId);
  const connections = await getIntegrationConnections(merchantId);

  return {
    merchantEmail:
      shopInfo?.email?.trim() ||
      merchant.email?.trim() ||
      googleConn?.email?.trim() ||
      null,
    shopName: shopInfo?.shopName ?? merchant.shopName,
    shopEmail: shopInfo?.email ?? merchant.email,
    merchantTimezone: merchant.timezone ?? "UTC",
    googleCalendarConnected: connections.google,
  };
}

export async function runBookingIntegrations(
  merchantId: string,
  bookingId: string,
  options: { emailKind?: BookingEmailKind } = {},
) {
  const emailKind = options.emailKind ?? "confirmed";

  try {
    let booking = await getBooking(merchantId, bookingId);
    if (!booking) return;

    const emailContext = await getBookingEmailContext(merchantId);
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { timezone: true },
    });
    const merchantNotifyEmail = emailContext.merchantEmail;

    const { service, meetingType, customer } = booking;
    const date = formatDateString(booking.bookingDate);
    const wantsVideo = meetingTypeHasVideoLink(meetingType);
    const connections = await getIntegrationConnections(merchantId);

    if (wantsVideo && connections.zoom && !booking.zoomMeetingId) {
      const zoom = await createZoomMeeting(merchantId, {
        topic: `${service.name} - ${customer.firstName} ${customer.lastName}`,
        date,
        startTime: booking.startTime,
        durationMinutes: service.durationMinutes,
        timeZone: merchant?.timezone ?? emailContext.merchantTimezone,
      });
      if (zoom) {
        booking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            zoomMeetingId: zoom.meetingId,
            zoomJoinUrl: zoom.joinUrl,
            zoomStartUrl: zoom.startUrl,
          },
          include: { service: true, meetingType: true, customer: true },
        });
      }
    }

    if (connections.google && !booking.googleCalendarEventId) {
      const googleConn = await getGoogleConnection(merchantId);
      const meetingLink = booking.zoomJoinUrl ?? undefined;
      const calendarEvent = await createCalendarEvent(merchantId, {
        title: `${service.name} - ${customer.firstName} ${customer.lastName}`,
        description: [
          `Service: ${service.name}`,
          `Customer: ${customer.firstName} ${customer.lastName}`,
          `Email: ${customer.email}`,
          customer.phone ? `Phone: ${customer.phone}` : "",
          `Meeting: ${meetingType.name}`,
          meetingLink ? `Zoom: ${meetingLink}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        attendeeEmail: customer.email,
        merchantEmail: merchantNotifyEmail,
        googleAccountEmail: googleConn?.email ?? null,
        timeZone: merchant?.timezone ?? emailContext.merchantTimezone,
        meetingLink,
        addGoogleMeet: wantsVideo,
      });

      if (calendarEvent) {
        booking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            googleCalendarEventId: calendarEvent.eventId,
            googleMeetUrl: calendarEvent.meetUrl,
          },
          include: { service: true, meetingType: true, customer: true },
        });
      }
    }

    await sendBookingNotificationEmails(booking, emailKind, emailContext).catch(
      console.error,
    );
  } catch (error) {
    console.error("[booking] integration sync failed", error);
  }
}

export async function getAvailableSlots(
  merchantId: string,
  serviceId: string,
  dateStr: string,
) {
  const service = await getService(merchantId, serviceId);
  if (!service?.active) return [];

  const timeZone = await getMerchantTimezone(merchantId);
  const date = parseDateString(dateStr);
  if (await isDateClosed(merchantId, date)) return [];

  const rules = await getAvailabilityRules(merchantId);
  const holidayOverride = await getHolidayOverrideForDate(merchantId, date);
  const bookings = await prisma.booking.findMany({
    where: {
      merchantId,
      bookingDate: date,
      status: { not: "CANCELLED" },
    },
  });

  return generateAvailableSlots({
    dateStr,
    timeZone,
    durationMinutes: service.durationMinutes,
    rules,
    bookings,
    hoursOverride:
      holidayOverride?.startTime && holidayOverride?.endTime
        ? {
            startTime: holidayOverride.startTime,
            endTime: holidayOverride.endTime,
          }
        : undefined,
  });
}

export async function getMonthAvailability(
  merchantId: string,
  serviceId: string,
  month: string,
) {
  const [year, monthNum] = month.split("-").map(Number);
  const service = await getService(merchantId, serviceId);
  if (!service?.active) {
    return { availableDates: [], unavailableDates: [], closedDates: [] };
  }

  const timeZone = await getMerchantTimezone(merchantId);
  const rules = await getAvailabilityRules(merchantId);
  const startDate = parseDateString(`${month}-01`);
  const endDate = new Date(Date.UTC(year, monthNum, 0));

  const closedSet = await getClosedDateSetForRange(
    merchantId,
    startDate,
    endDate,
  );

  const holidayRanges = await getClosedDatesInRange(
    merchantId,
    startDate,
    endDate,
  );
  const specialHoursByDate = new Map<
    string,
    { startTime: string; endTime: string }
  >();
  for (const range of holidayRanges) {
    if (range.closedAllDay || !range.startTime || !range.endTime) continue;
    const cursor = new Date(range.date);
    const end = range.endDate;
    while (cursor <= end) {
      const dateStr = cursor.toISOString().slice(0, 10);
      specialHoursByDate.set(dateStr, {
        startTime: range.startTime,
        endTime: range.endTime,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const bookings = await prisma.booking.findMany({
    where: {
      merchantId,
      bookingDate: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
  });

  return getAvailableDatesInMonth({
    year,
    month: monthNum,
    timeZone,
    durationMinutes: service.durationMinutes,
    rules,
    bookings,
    closedDates: closedSet,
    specialHoursByDate,
    minDate: todayInTimezone(timeZone),
  });
}

async function checkBookingLimit(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { subscription: true },
  });
  const plan = merchant?.subscription?.plan ?? "FREE";
  const limit =
    BILLING_PLANS[plan as keyof typeof BILLING_PLANS]?.bookingLimit ?? null;

  if (limit === null) return;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const count = await prisma.booking.count({
    where: {
      merchantId,
      status: { not: "CANCELLED" },
      createdAt: { gte: startOfMonth },
    },
  });

  if (count >= limit) {
    throw new BookingError(
      "Monthly booking limit reached. Please upgrade your plan.",
      "BOOKING_LIMIT",
    );
  }
}

export class BookingError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export async function createBooking(
  merchantId: string,
  input: {
    serviceId: string;
    meetingTypeId: string;
    date: string;
    startTime: string;
    customer: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      note?: string;
    };
  },
  options?: { deferIntegrations?: boolean },
) {
  await checkBookingLimit(merchantId);

  const service = await getService(merchantId, input.serviceId);
  if (!service?.active) {
    throw new BookingError("Service is not available", "SERVICE_INACTIVE");
  }

  const meetingType = await getMeetingType(merchantId, input.meetingTypeId);
  if (!meetingType?.active) {
    throw new BookingError("Meeting type is not available", "MEETING_TYPE_INACTIVE");
  }

  const linkedTypes = await listMeetingTypesForService(
    merchantId,
    input.serviceId,
  );
  if (!linkedTypes.some((t: { id: string }) => t.id === input.meetingTypeId)) {
    throw new BookingError(
      "Meeting type is not supported for this service",
      "MEETING_TYPE_NOT_LINKED",
    );
  }

  const slots = await getAvailableSlots(
    merchantId,
    input.serviceId,
    input.date,
  );
  const slot = slots.find((s) => s.startTime === input.startTime);
  if (!slot) {
    throw new BookingError("Selected time slot is not available", "SLOT_UNAVAILABLE");
  }

  const customer = await findOrCreateCustomer(merchantId, input.customer);

  try {
    const booking = await prisma.booking.create({
      data: {
        merchantId,
        serviceId: input.serviceId,
        meetingTypeId: input.meetingTypeId,
        customerId: customer.id,
        bookingDate: parseDateString(input.date),
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "CONFIRMED",
        note: input.customer.note,
      },
      include: {
        service: true,
        meetingType: true,
        customer: true,
      },
    });

    if (options?.deferIntegrations) {
      return booking;
    }

    await runBookingIntegrations(merchantId, booking.id);
    return (await getBooking(merchantId, booking.id)) ?? booking;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new BookingError("This time slot was just booked", "SLOT_TAKEN");
    }
    throw error;
  }
}

export async function listBookings(
  merchantId: string,
  filters: {
    status?: BookingStatus;
    serviceId?: string;
    date?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const skip = (page - 1) * limit;

  const where = {
    merchantId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    ...(filters.date
      ? { bookingDate: parseDateString(filters.date) }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        service: true,
        meetingType: true,
        customer: true,
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, limit };
}

export async function getBookingStatusCounts(merchantId: string) {
  const groups = await prisma.booking.groupBy({
    by: ["status"],
    where: { merchantId },
    _count: { _all: true },
  });

  const counts = { total: 0, CONFIRMED: 0, CANCELLED: 0 };
  for (const group of groups) {
    if (group.status === "CONFIRMED") {
      counts.CONFIRMED = group._count._all;
    } else if (group.status === "CANCELLED") {
      counts.CANCELLED = group._count._all;
    }
    counts.total += group._count._all;
  }
  return counts;
}

export async function getBooking(merchantId: string, bookingId: string) {
  return prisma.booking.findFirst({
    where: { id: bookingId, merchantId },
    include: {
      service: true,
      meetingType: true,
      customer: true,
    },
  });
}

async function cleanupBookingIntegrations(
  merchantId: string,
  booking: {
    googleCalendarEventId: string | null;
    zoomMeetingId: string | null;
  },
) {
  if (booking.googleCalendarEventId) {
    await deleteCalendarEvent(merchantId, booking.googleCalendarEventId).catch(
      console.error,
    );
  }
  if (booking.zoomMeetingId) {
    await deleteZoomMeeting(merchantId, booking.zoomMeetingId).catch(
      console.error,
    );
  }
}

export async function cancelBooking(merchantId: string, bookingId: string) {
  const existing = await getBooking(merchantId, bookingId);
  if (!existing) {
    throw new BookingError("Booking not found", "NOT_FOUND");
  }
  if (existing.status === "CANCELLED") {
    return existing;
  }

  await cleanupBookingIntegrations(merchantId, existing);

  const cancelled = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      googleCalendarEventId: null,
      googleMeetUrl: null,
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomStartUrl: null,
    },
    include: {
      service: true,
      meetingType: true,
      customer: true,
    },
  });

  const emailContext = await getBookingEmailContext(merchantId);
  void sendBookingNotificationEmails(cancelled, "cancelled", emailContext).catch(
    console.error,
  );

  return cancelled;
}

export async function deleteBooking(merchantId: string, bookingId: string) {
  const existing = await getBooking(merchantId, bookingId);
  if (!existing) {
    throw new BookingError("Booking not found", "NOT_FOUND");
  }

  await cleanupBookingIntegrations(merchantId, existing);

  const emailContext = await getBookingEmailContext(merchantId);
  void sendBookingNotificationEmails(existing, "deleted", emailContext).catch(
    console.error,
  );

  await prisma.booking.delete({
    where: { id: bookingId },
  });
}

export async function rescheduleBooking(
  merchantId: string,
  bookingId: string,
  input: { date: string; startTime: string },
) {
  const existing = await getBooking(merchantId, bookingId);
  if (!existing) {
    throw new BookingError("Booking not found", "NOT_FOUND");
  }
  if (existing.status !== "CANCELLED") {
    throw new BookingError(
      "Only cancelled bookings can be rescheduled",
      "INVALID_STATUS",
    );
  }

  const slots = await getAvailableSlots(
    merchantId,
    existing.serviceId,
    input.date,
  );
  const slot = slots.find((s) => s.startTime === input.startTime);
  if (!slot) {
    throw new BookingError(
      "Selected time slot is not available",
      "SLOT_UNAVAILABLE",
    );
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      bookingDate: parseDateString(input.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
      googleCalendarEventId: null,
      googleMeetUrl: null,
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomStartUrl: null,
    },
  });

  await runBookingIntegrations(merchantId, bookingId, {
    emailKind: "rescheduled",
  });
  const booking = await getBooking(merchantId, bookingId);
  if (!booking) {
    throw new BookingError("Booking not found", "NOT_FOUND");
  }
  return booking;
}

export async function getDashboardStats(merchantId: string) {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [confirmedThisMonth, services, meetingTypes, recentBookings] =
    await Promise.all([
      prisma.booking.count({
        where: {
          merchantId,
          status: "CONFIRMED",
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.service.count({ where: { merchantId, active: true } }),
      prisma.meetingType.count({ where: { merchantId, active: true } }),
      prisma.booking.findMany({
        where: { merchantId },
        include: { service: true, customer: true, meetingType: true },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
        take: 5,
      }),
    ]);

  return {
    confirmedThisMonth,
    activeServices: services,
    activeMeetingTypes: meetingTypes,
    recentBookings,
  };
}
