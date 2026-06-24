import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { requireAdminMerchant } from "../lib/auth.server";
import { embeddedAppAdminUrl } from "../lib/shopify/admin-url.server";
import { syncSubscription, mapBillingPlanToDb } from "../models/subscription.server";
import { z } from "zod";

const schema = z.object({
  plan: z.enum(["Annual Premium", "Shopify Test", "Test", "Legacy Access", "Free"]),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant, session } = await requireAdminMerchant(request);
  const { billing } = await authenticate.admin(request);
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const planKey = parsed.data.plan;

  if (planKey === "Free" || planKey === "Legacy Access") {
    await syncSubscription(merchant.id, {
      plan: mapBillingPlanToDb(planKey),
      status: "ACTIVE",
    });
    return Response.json({ ok: true, plan: planKey });
  }

  return billing.request({
    plan: planKey,
    isTest: planKey !== "Annual Premium",
    returnUrl: embeddedAppAdminUrl(session.shop, "/app/billing"),
  } as Parameters<typeof billing.request>[0]);
};
