import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateMerchant } from "../models/merchant.server";
import { getGoogleAuthUrl } from "../lib/integrations/google/calendar.server";
import { syncMerchantSubscriptionFromShopify } from "../lib/billing/billing.server";
import {
  hasPremiumAccess,
  PREMIUM_REQUIRED_MESSAGE,
} from "../models/subscription.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  try {
    await syncMerchantSubscriptionFromShopify(
      merchant.id,
      request,
      billing,
      admin,
    );
  } catch (error) {
    console.warn("[google/connect] billing sync:", error);
  }

  if (!(await hasPremiumAccess(merchant.id))) {
    return Response.json({ ok: false, error: PREMIUM_REQUIRED_MESSAGE }, {
      status: 403,
    });
  }

  const url = getGoogleAuthUrl(merchant.id, session.shop);
  return Response.json({ url });
};
