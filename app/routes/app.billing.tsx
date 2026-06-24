import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { requireAdminMerchant } from "../lib/auth.server";
import { BILLING_PLANS } from "../lib/constants";
import { syncSubscription, mapBillingPlanToDb } from "../models/subscription.server";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";

const PLAN_KEYS = {
  FREE: "Free",
  SHOPIFY_TEST: "Shopify Test",
  TEST: "Test",
  LEGACY_ACCESS: "Legacy Access",
  ANNUAL_PREMIUM: "Annual Premium",
} as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant, session } = await requireAdminMerchant(request);
  const { billing } = await authenticate.admin(request);

  try {
    await billing.check({
      plans: ["Annual Premium"] as never[],
      isTest: true,
    });
  } catch {
    /* billing check optional */
  }

  return {
    subscription: merchant.subscription,
    plans: Object.values(BILLING_PLANS),
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const plan = formData.get("plan") as string;
  const res = await fetch(new URL("/api/billing/subscribe", request.url).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: request.headers.get("Cookie") ?? "",
    },
    body: JSON.stringify({ plan }),
  });
  if (res.redirected || res.headers.get("content-type")?.includes("text/html")) {
    return res;
  }
  return await res.json();
};

export default function BillingPage() {
  const { subscription, plans } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const currentPlan = subscription?.plan ?? "FREE";

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data === "object" && data != null && "ok" in data && data.ok) {
      showAppToast(shopify, "Plan updated");
    }
  });

  function subscribe(planKey: string) {
    fetcher.submit({ plan: planKey }, { method: "post" });
  }

  return (
    <s-page heading="Billing">
      <s-section heading="Current plan">
        <s-paragraph>
          You are on the <strong>{currentPlan}</strong> plan
          {subscription?.status ? ` (${subscription.status})` : ""}.
        </s-paragraph>
      </s-section>
      <s-section heading="Available plans">
        {plans.map((plan) => {
          const key = PLAN_KEYS[plan.plan as keyof typeof PLAN_KEYS] ?? plan.plan;
          return (
            <s-box key={plan.plan} padding="base" borderWidth="base" borderRadius="base">
              <s-heading>{plan.name}</s-heading>
              <s-unordered-list>
                {plan.features.map((f) => (
                  <s-list-item key={f}>{f}</s-list-item>
                ))}
              </s-unordered-list>
              {plan.plan === currentPlan ? (
                <s-text>Current plan</s-text>
              ) : (
                <s-button onClick={() => subscribe(key)}>Select plan</s-button>
              )}
            </s-box>
          );
        })}
      </s-section>
    </s-page>
  );
}

export const headers = boundary.headers;
