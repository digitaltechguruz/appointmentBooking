import prisma from "../db.server";
import type { SubscriptionPlan, SubscriptionStatus, BillingInterval } from "@prisma/client";
import { INTEGRATIONS_PREMIUM_MESSAGE } from "../lib/constants";
import { isPremiumPlan, planHandleToDb } from "../lib/billing/plans.shared";

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

/** Map Shopify App Pricing plan handle or subscription name to DB plan. */
export function mapBillingPlanToDb(planKey: string): SubscriptionPlan {
  return planHandleToDb(planKey);
}

export async function hasPremiumAccess(merchantId: string): Promise<boolean> {
  const sub = await getSubscription(merchantId);
  if (!sub) return false;
  if (!["ACTIVE", "PENDING"].includes(sub.status)) return false;
  return isPremiumPlan(sub.plan);
}

export const PREMIUM_REQUIRED_MESSAGE = INTEGRATIONS_PREMIUM_MESSAGE;
