import prisma from "../db.server";
import type { Prisma } from "@prisma/client";

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

export async function createService(
  merchantId: string,
  data: {
    name: string;
    description?: string;
    imageUrl?: string;
    durationMinutes: number;
    active: boolean;
    meetingTypeIds?: string[];
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
  },
) {
  const updates: Prisma.ServiceUpdateInput = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl || null;
  if (data.durationMinutes !== undefined)
    updates.durationMinutes = data.durationMinutes;
  if (data.active !== undefined) updates.active = data.active;

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
