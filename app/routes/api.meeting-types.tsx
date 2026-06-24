import type { LoaderFunctionArgs } from "react-router";
import { requirePublicMerchant } from "../lib/auth.server";
import { listMeetingTypesForService } from "../models/meeting-type.server";
import { z } from "zod";
import type { MeetingType } from "@prisma/client";

const querySchema = z.object({
  shop: z.string().min(1),
  serviceId: z.string().min(1),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requirePublicMerchant(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const meetingTypes = await listMeetingTypesForService(
    merchant.id,
    parsed.data.serviceId,
  );

  return Response.json({
    meetingTypes: meetingTypes.map((mt: MeetingType) => ({
      id: mt.id,
      name: mt.name,
      subtitle: mt.subtitle,
      description: mt.description,
      type: mt.type,
      imageUrl: mt.imageUrl,
    })),
  });
};
