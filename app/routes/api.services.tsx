import type { LoaderFunctionArgs } from "react-router";
import { requirePublicMerchant } from "../lib/auth.server";
import { listServices } from "../models/service.server";
import { parseQuery, shopQuerySchema } from "../lib/validation/schemas";
import type { Service, ServiceMeetingType, MeetingType } from "@prisma/client";

type ServiceWithMeetingTypes = Service & {
  meetingTypes: (ServiceMeetingType & { meetingType: MeetingType })[];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requirePublicMerchant(request);
  const parsed = parseQuery(shopQuerySchema, new URL(request.url).searchParams);

  if (!parsed.success) {
    return Response.json({ error: parsed.errors }, { status: 400 });
  }

  const services = await listServices(merchant.id, true);
  return Response.json({
    services: (services as ServiceWithMeetingTypes[]).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      imageUrl: s.imageUrl,
      durationMinutes: s.durationMinutes,
      meetingTypeIds: s.meetingTypes.map((mt) => mt.meetingTypeId),
    })),
  });
};
