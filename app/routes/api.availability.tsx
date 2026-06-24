import type { LoaderFunctionArgs } from "react-router";
import { requirePublicMerchant } from "../lib/auth.server";
import {
  getAvailableSlots,
  getMonthAvailability,
} from "../models/booking.server";
import {
  availabilityQuerySchema,
  parseQuery,
} from "../lib/validation/schemas";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requirePublicMerchant(request);
  const parsed = parseQuery(
    availabilityQuerySchema,
    new URL(request.url).searchParams,
  );

  if (!parsed.success) {
    return Response.json({ error: parsed.errors }, { status: 400 });
  }

  const { serviceId, date, month } = parsed.data;

  if (date) {
    const slots = await getAvailableSlots(merchant.id, serviceId, date);
    return Response.json({ date, slots });
  }

  if (month) {
    const availability = await getMonthAvailability(
      merchant.id,
      serviceId,
      month,
    );
    return Response.json(availability);
  }

  return Response.json(
    { error: "Provide either date or month parameter" },
    { status: 400 },
  );
};
