import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateMerchant } from "../models/merchant.server";
import { getZoomAuthUrl } from "../lib/integrations/zoom/meetings.server";
import { syncMerchantSubscriptionFromShopify } from "../lib/billing/billing.server";
import {
  hasPremiumAccess,
  PREMIUM_REQUIRED_MESSAGE,
} from "../models/subscription.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
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
      console.warn("[zoom/connect] billing sync:", error);
    }

    if (!(await hasPremiumAccess(merchant.id))) {
      return Response.json({ ok: false, error: PREMIUM_REQUIRED_MESSAGE }, {
        status: 403,
      });
    }

    const url = getZoomAuthUrl(merchant.id, session.shop);
    return Response.json({ ok: true, url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Zoom connection";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
};
