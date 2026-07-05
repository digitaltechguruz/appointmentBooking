import type { SubscriptionPlan } from "@prisma/client";

/** Plan handles configured in Partner Dashboard → Shopify App Pricing */
export const SHOPIFY_PLAN_HANDLES = {
  FREE: "free-plan",
  PRO: "pro",
  SHOPIFY_TEST: "shopify-test",
} as const;

export type ShopifyPlanHandle =
  (typeof SHOPIFY_PLAN_HANDLES)[keyof typeof SHOPIFY_PLAN_HANDLES];

export function normalizePlanHandle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function planHandleToDb(handle: string): SubscriptionPlan {
  const normalized = normalizePlanHandle(handle);

  if (normalized === SHOPIFY_PLAN_HANDLES.FREE || normalized === "free") {
    return "FREE";
  }
  if (
    normalized === SHOPIFY_PLAN_HANDLES.SHOPIFY_TEST ||
    normalized === "shopify-test" ||
    normalized.includes("shopify-test")
  ) {
    return "SHOPIFY_TEST";
  }
  if (
    normalized === SHOPIFY_PLAN_HANDLES.PRO ||
    normalized === "pro" ||
    normalized.includes("pro-plan") ||
    normalized === "premium"
  ) {
    return "PRO";
  }

  return "FREE";
}

export function isPremiumPlan(plan: SubscriptionPlan) {
  return plan === "PRO" || plan === "SHOPIFY_TEST";
}

export function dbPlanToHandle(plan: SubscriptionPlan): ShopifyPlanHandle {
  if (plan === "PRO") return SHOPIFY_PLAN_HANDLES.PRO;
  if (plan === "SHOPIFY_TEST") return SHOPIFY_PLAN_HANDLES.SHOPIFY_TEST;
  return SHOPIFY_PLAN_HANDLES.FREE;
}
