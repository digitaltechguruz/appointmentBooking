import prisma from "../db.server";
import type { MeetingType, MeetingTypeKind, Prisma } from "@prisma/client";
import {
  getIntegrationConnections,
  isMeetingTypeIntegrationAvailable,
} from "../lib/integrations/status.server";

export async function listMeetingTypes(
  merchantId: string,
  activeOnly = false,
) {
  return prisma.meetingType.findMany({
    where: {
      merchantId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getMeetingType(
  merchantId: string,
  meetingTypeId: string,
) {
  return prisma.meetingType.findFirst({
    where: { id: meetingTypeId, merchantId },
  });
}

export async function createMeetingType(
  merchantId: string,
  data: {
    name: string;
    subtitle?: string;
    description?: string;
    type: MeetingTypeKind;
    videoLinkEnabled?: boolean;
    imageUrl?: string;
    active: boolean;
  },
) {
  return prisma.meetingType.create({
    data: { merchantId, ...data },
  });
}

export async function updateMeetingType(
  merchantId: string,
  meetingTypeId: string,
  data: Partial<{
    name: string;
    subtitle: string;
    description: string;
    type: MeetingTypeKind;
    videoLinkEnabled: boolean;
    imageUrl: string;
    active: boolean;
  }>,
) {
  return prisma.meetingType.update({
    where: { id: meetingTypeId, merchantId },
    data,
  });
}

export async function deleteMeetingType(
  merchantId: string,
  meetingTypeId: string,
): Promise<
  | { deleted: true }
  | { deleted: false; deactivated: true; bookingCount: number }
> {
  const meetingType = await prisma.meetingType.findFirst({
    where: { id: meetingTypeId, merchantId },
  });
  if (!meetingType) {
    throw new Error("Meeting type not found");
  }

  const bookingCount = await prisma.booking.count({
    where: { meetingTypeId, merchantId },
  });

  if (bookingCount > 0) {
    await prisma.meetingType.update({
      where: { id: meetingTypeId, merchantId },
      data: { active: false },
    });
    return { deleted: false, deactivated: true, bookingCount };
  }

  await prisma.meetingType.delete({
    where: { id: meetingTypeId, merchantId },
  });
  return { deleted: true };
}

export async function listMeetingTypesForService(
  merchantId: string,
  serviceId: string,
) {
  const links: Prisma.ServiceMeetingTypeGetPayload<{
    include: { meetingType: true };
  }>[] = await prisma.serviceMeetingType.findMany({
    where: {
      serviceId,
      service: { merchantId },
      meetingType: { active: true },
    },
    include: { meetingType: true },
  });
  const connections = await getIntegrationConnections(merchantId);

  return links
    .map((link) => link.meetingType)
    .filter((mt) => isMeetingTypeIntegrationAvailable(mt, connections));
}
