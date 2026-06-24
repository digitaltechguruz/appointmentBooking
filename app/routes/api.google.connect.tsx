import type { ActionFunctionArgs } from "react-router";
import { requireAdminMerchant } from "../lib/auth.server";
import { getGoogleAuthUrl } from "../lib/integrations/google/calendar.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant, session } = await requireAdminMerchant(request);
  const url = getGoogleAuthUrl(merchant.id, session.shop);
  return Response.json({ url });
};
