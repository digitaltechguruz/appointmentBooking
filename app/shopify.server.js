import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    "Annual Premium": {
      lineItems: [
        {
          amount: 99,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
    "Shopify Test": {
      lineItems: [
        {
          amount: 0.01,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      test: true,
    },
    Test: {
      lineItems: [
        {
          amount: 0.01,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      test: true,
    },
    "Legacy Access": {
      lineItems: [
        {
          amount: 0,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin, session }) => {
      await shopify.registerWebhooks({ session });

      const { localeFromSession } = await import("./lib/admin-i18n.shared.js");
      const uiLocale = localeFromSession(session) || "en";

      void import("./lib/widget/booking-widget-i18n-metaobject.server.js")
        .then(async ({ provisionWidgetTextMetaobject, ensureWidgetTextContentPopulated }) => {
          const result = await provisionWidgetTextMetaobject(admin, {
            scope: session.scope,
            shopDomain: session.shop,
            skipIfReady: true,
            uiLocale,
          });
          if (result?.ok) {
            await ensureWidgetTextContentPopulated(admin, session.shop);
          }
          return result;
        })
        .then((result) => {
          if (result && !result.ok) {
            console.warn(
              `[afterAuth] Booking widget text metaobject for ${session.shop}:`,
              result.error,
            );
          }
        })
        .catch((error) => {
          console.warn(
            `[afterAuth] Booking widget text metaobject for ${session.shop}:`,
            error?.message || error,
          );
        });

      void import("./lib/dashboard/dashboard-i18n-metaobject.server.js")
        .then(({ provisionDashboardTextMetaobject }) =>
          provisionDashboardTextMetaobject(admin, {
            shopDomain: session.shop,
            skipIfReady: true,
            uiLocale,
          }),
        )
        .then((result) => {
          if (result && !result.ok) {
            console.warn(
              `[afterAuth] Dashboard text metaobject for ${session.shop}:`,
              result.error,
            );
          }
        })
        .catch((error) => {
          console.warn(
            `[afterAuth] Dashboard text metaobject for ${session.shop}:`,
            error?.message || error,
          );
        });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
