import prisma from "../db.server";
import type { Prisma } from "@prisma/client";
import type { ServiceBookingRulesInput } from "../lib/booking/booking-rules.server";

export async function listServices(merchantId: string, activeOnly = false) {
  return prisma.service.findMany({
    where: {
      merchantId,
      ...(activeOnly ? { active: true } : {}),
    },
    include: {
      meetingTypes: {
        include: { meetingType: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getService(merchantId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, merchantId },
    include: {
      meetingTypes: { include: { meetingType: true } },
    },
  });
}

function bookingRulesToServiceData(
  bookingRules?: ServiceBookingRulesInput,
): Prisma.ServiceUpdateInput {
  if (!bookingRules) return {};

  if (!bookingRules.useCustomBookingRules) {
    return {
      useCustomBookingRules: false,
      slotIntervalMinutes: null,
      minNoticeMinutes: null,
      maxAdvanceDays: null,
      bufferBeforeMinutes: null,
      bufferAfterMinutes: null,
      maxBookingsPerDay: null,
      maxBookingsPerSlot: null,
      lookBusyEnabled: null,
      lookBusyPercent: null,
    };
  }

  return {
    useCustomBookingRules: true,
    slotIntervalMinutes: bookingRules.slotIntervalMinutes ?? null,
    minNoticeMinutes: bookingRules.minNoticeMinutes ?? null,
    maxAdvanceDays: bookingRules.maxAdvanceDays ?? null,
    bufferBeforeMinutes: bookingRules.bufferBeforeMinutes ?? null,
    bufferAfterMinutes: bookingRules.bufferAfterMinutes ?? null,
    maxBookingsPerDay: bookingRules.maxBookingsPerDay ?? null,
    maxBookingsPerSlot: bookingRules.maxBookingsPerSlot ?? null,
    lookBusyEnabled: bookingRules.lookBusyEnabled ?? null,
    lookBusyPercent: bookingRules.lookBusyPercent ?? null,
  };
}

export async function createService(
  merchantId: string,
  data: {
    name: string;
    description?: string;
    imageUrl?: string;
    durationMinutes: number;
    active: boolean;
    meetingTypeIds?: string[];
    bookingRules?: ServiceBookingRulesInput;
  },
) {
  return prisma.service.create({
    data: {
      merchantId,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl || null,
      durationMinutes: data.durationMinutes,
      active: data.active,
      ...bookingRulesToServiceData(data.bookingRules),
      meetingTypes: data.meetingTypeIds?.length
        ? {
            create: data.meetingTypeIds.map((meetingTypeId) => ({
              meetingTypeId,
            })),
          }
        : undefined,
    },
    include: {
      meetingTypes: { include: { meetingType: true } },
    },
  });
}

export async function updateService(
  merchantId: string,
  serviceId: string,
  data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    durationMinutes?: number;
    active?: boolean;
    meetingTypeIds?: string[];
    bookingRules?: ServiceBookingRulesInput;
  },
) {
  const updates: Prisma.ServiceUpdateInput = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl || null;
  if (data.durationMinutes !== undefined)
    updates.durationMinutes = data.durationMinutes;
  if (data.active !== undefined) updates.active = data.active;
  if (data.bookingRules !== undefined) {
    Object.assign(updates, bookingRulesToServiceData(data.bookingRules));
  }

  if (data.meetingTypeIds !== undefined) {
    await prisma.serviceMeetingType.deleteMany({
      where: { serviceId },
    });
    if (data.meetingTypeIds.length > 0) {
      await prisma.serviceMeetingType.createMany({
        data: data.meetingTypeIds.map((meetingTypeId) => ({
          serviceId,
          meetingTypeId,
        })),
      });
    }
  }

  return prisma.service.update({
    where: { id: serviceId, merchantId },
    data: updates,
    include: {
      meetingTypes: { include: { meetingType: true } },
    },
  });
}

export async function deleteService(merchantId: string, serviceId: string) {
  return prisma.service.delete({
    where: { id: serviceId, merchantId },
  });
}
