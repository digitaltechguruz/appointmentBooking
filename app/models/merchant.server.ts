import prisma from "../db.server";
import { SubscriptionPlan } from "@prisma/client";
import {
  DEFAULT_WORKING_HOURS,
  DAYS_OF_WEEK,
  MEETING_TYPE_KINDS,
  MEETING_TYPE_LABELS,
} from "../lib/constants";
import type { ShopInfo } from "../lib/shopify/shop-info.server";
import { fetchShopInfo } from "../lib/shopify/shop-info.server";
import { unauthenticated } from "../shopify.server";

/**
 * Resolve or create a Merchant record for a Shopify shop domain.
 * Seeds default availability rules and a free subscription on first install.
 */
export async function getOrCreateMerchant(shop: string, email?: string) {
  const existing = await prisma.merchant.findUnique({
    where: { shop },
    include: { subscription: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.merchant.create({
    data: {
      shop,
      email,
      availabilityRules: {
        create: DAYS_OF_WEEK.map((dayOfWeek) => ({
          dayOfWeek,
          enabled: !["SATURDAY", "SUNDAY"].includes(dayOfWeek),
          startTime: DEFAULT_WORKING_HOURS.startTime,
          endTime: DEFAULT_WORKING_HOURS.endTime,
        })),
      },
      subscription: {
        create: {
          plan: SubscriptionPlan.FREE,
          status: "ACTIVE",
        },
      },
      meetingTypes: {
        create: MEETING_TYPE_KINDS.map((type) => ({
          name: MEETING_TYPE_LABELS[type],
          type,
          active: true,
        })),
      },
    },
    include: { subscription: true },
  });
}

export async function getMerchantByShop(shop: string) {
  return prisma.merchant.findUnique({
    where: { shop },
    include: { subscription: true },
  });
}

export async function getMerchantTimezone(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true },
  });
  return merchant?.timezone ?? "UTC";
}

export async function updateMerchantSettings(
  merchantId: string,
  data: {
    shopName?: string;
    timezone?: string;
    email?: string;
    locale?: "en" | "fr" | "de" | "nl" | "it" | "es" | "ru" | "ar";
    hoursTimeFormat?: "HOUR_12" | "HOUR_24";
    weekStartsOn?: "MONDAY" | "SUNDAY";
    widgetTheme?: "CLASSIC" | "MODERN";
  },
) {
  return prisma.merchant.update({
    where: { id: merchantId },
    data,
  });
}

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export async function syncMerchantFromShopify(
  merchantId: string,
  shopInfo: ShopInfo,
) {
  const data: {
    shopName?: string;
    timezone?: string;
    email?: string;
  } = {};

  if (shopInfo.name) data.shopName = shopInfo.name;
  if (shopInfo.ianaTimezone) data.timezone = shopInfo.ianaTimezone;
  if (shopInfo.email) data.email = shopInfo.email;

  if (Object.keys(data).length === 0) {
    return prisma.merchant.findUnique({ where: { id: merchantId } });
  }

  return updateMerchantSettings(merchantId, data);
}

export async function syncMerchantFromShopifyAdmin(
  merchantId: string,
  admin: AdminGraphql,
) {
  const shopInfo = await fetchShopInfo(admin);
  return syncMerchantFromShopify(merchantId, shopInfo);
}

export async function ensureMerchantShopInfo(merchantId: string, shop: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { shopName: true, email: true },
  });

  if (merchant?.shopName && merchant.email) {
    return merchant;
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const shopInfo = await fetchShopInfo(admin);
    await syncMerchantFromShopify(merchantId, shopInfo);
    return prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { shopName: true, email: true },
    });
  } catch (error) {
    console.warn("[merchant] could not sync shop info from Shopify", error);
    return merchant;
  }
}
