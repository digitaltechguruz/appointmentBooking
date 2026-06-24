import prisma from "../db.server";
import type { SubscriptionPlan, SubscriptionStatus, BillingInterval } from "@prisma/client";

export async function syncSubscription(
  merchantId: string,
  data: {
    plan: SubscriptionPlan;
    shopifySubscriptionId?: string;
    status: SubscriptionStatus;
    billingInterval?: BillingInterval;
    currentPeriodEnd?: Date;
  },
) {
  return prisma.subscription.upsert({
    where: { merchantId },
    create: { merchantId, ...data },
    update: data,
  });
}

export async function getSubscription(merchantId: string) {
  return prisma.subscription.findUnique({ where: { merchantId } });
}

export function mapBillingPlanToDb(planKey: string): SubscriptionPlan {
  const map: Record<string, SubscriptionPlan> = {
    "Annual Premium": "ANNUAL_PREMIUM",
    "Shopify Test": "SHOPIFY_TEST",
    Test: "TEST",
    "Legacy Access": "LEGACY_ACCESS",
    Free: "FREE",
  };
  return map[planKey] ?? "FREE";
}

export async function hasPremiumAccess(merchantId: string): Promise<boolean> {
  const sub = await getSubscription(merchantId);
  if (!sub || sub.status !== "ACTIVE") return false;
  return ["ANNUAL_PREMIUM", "LEGACY_ACCESS", "SHOPIFY_TEST", "TEST"].includes(sub.plan);
}
