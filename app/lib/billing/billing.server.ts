import type { BillingCheckResponseObject } from "@shopify/shopify-api";
import type { SubscriptionPlan } from "@prisma/client";
import { syncSubscription } from "../../models/subscription.server";
import { isPremiumPlan, planHandleToDb } from "./plans.shared";
import { getPlanSelectionUrl } from "./pricing-url";

export { getPlanSelectionUrl, getShopifyAppHandle, getStoreHandle } from "./pricing-url";

type BillingApi = {
  check: (params?: { isTest?: boolean }) => Promise<BillingCheckResponseObject>;
};

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query AppInstallationActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        lineItems {
          plan {
            pricingDetails {
              __typename
              ... on AppRecurringPricing {
                planHandle
              }
            }
          }
        }
      }
    }
  }
`;

async function checkBillingAny(billing: BillingApi): Promise<BillingCheckResponseObject> {
  const attempts = await Promise.allSettled([
    billing.check(),
    billing.check({ isTest: true }),
    billing.check({ isTest: false }),
  ]);

  let best: BillingCheckResponseObject = {
    hasActivePayment: false,
    appSubscriptions: [],
  };

  for (const attempt of attempts) {
    if (attempt.status !== "fulfilled") continue;
    const result = attempt.value;
    if (result.hasActivePayment || result.appSubscriptions?.length) {
      return result;
    }
    best = result;
  }

  return best;
}

async function fetchManagedPricingPlan(admin: AdminGraphql | undefined) {
  if (!admin?.graphql) return null;

  try {
    const res = await admin.graphql(ACTIVE_SUBSCRIPTION_QUERY);
    const json = await res.json();
    const subs =
      json?.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active =
      subs.find(
        (sub: { status?: string }) =>
          (sub.status || "").toUpperCase() === "ACTIVE",
      ) ?? subs[0];

    if (!active) {
      return { plan: "FREE" as SubscriptionPlan };
    }

    for (const lineItem of active.lineItems ?? []) {
      const handle = lineItem?.plan?.pricingDetails?.planHandle;
      if (handle) {
        return {
          plan: planHandleToDb(String(handle)),
          shopifySubscriptionId: active.id as string,
        };
      }
    }

    if (active.name) {
      const fromName = planHandleToDb(String(active.name));
      return {
        plan: fromName,
        shopifySubscriptionId: active.id as string,
      };
    }

    return {
      plan: "PRO" as SubscriptionPlan,
      shopifySubscriptionId: active.id as string,
    };
  } catch (error) {
    console.warn(
      "[billing] managed pricing lookup:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function resolvePlanFromBilling(
  planHandleParam: string | null,
  billingResult: BillingCheckResponseObject,
  managedPlan: { plan: SubscriptionPlan; shopifySubscriptionId?: string } | null,
): { plan: SubscriptionPlan; shopifySubscriptionId?: string } {
  if (planHandleParam) {
    return { plan: planHandleToDb(planHandleParam) };
  }

  if (managedPlan) {
    return managedPlan;
  }

  const activeSub = billingResult.appSubscriptions[0];
  if (activeSub) {
    const plan = planHandleToDb(activeSub.name);
    if (isPremiumPlan(plan) || plan !== "FREE") {
      return {
        plan,
        shopifySubscriptionId: activeSub.id,
      };
    }
  }

  if (billingResult.hasActivePayment) {
    return { plan: "PRO" };
  }

  return { plan: "FREE" };
}

/**
 * Sync local subscription row from Shopify App Pricing.
 * Uses managed-pricing GraphQL planHandle, billing.check(), and plan_handle URL param.
 */
export async function syncMerchantSubscriptionFromShopify(
  merchantId: string,
  request: Request,
  billing: BillingApi,
  admin?: AdminGraphql,
) {
  const [billingResult, managedPlan] = await Promise.all([
    checkBillingAny(billing),
    fetchManagedPricingPlan(admin),
  ]);

  const planHandleParam = new URL(request.url).searchParams.get("plan_handle");
  const { plan, shopifySubscriptionId } = resolvePlanFromBilling(
    planHandleParam,
    billingResult,
    managedPlan,
  );

  return syncSubscription(merchantId, {
    plan,
    status: "ACTIVE",
    shopifySubscriptionId,
    billingInterval: plan === "FREE" ? undefined : "MONTHLY",
  });
}
