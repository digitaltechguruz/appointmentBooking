import {
  getMerchantWidgetAppearance,
  buildWidgetSettingsFromSources,
} from "./appearance.server";
import { resolveStorefrontTranslationValues } from "./storefront-translations.server";
import type { WidgetTheme } from "@prisma/client";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function normalizeStorefrontLocale(locale: string) {
  const raw = (locale || "en").toString().trim();
  if (!raw) return "en";
  return raw.replace(/_/g, "-");
}

export async function resolveStorefrontWidgetSettings(
  shop: string,
  merchantId: string,
  options: { locale: string; widgetTheme: WidgetTheme; admin?: AdminClient | null },
) {
  const locale = normalizeStorefrontLocale(options.locale);
  const appearance = await getMerchantWidgetAppearance(merchantId);
  const resolved = await resolveStorefrontTranslationValues(
    shop,
    locale,
    options.admin,
  );

  return buildWidgetSettingsFromSources(resolved.translationValues, {
    ...appearance,
    visible: true,
  }, {
    locale: resolved.locale,
    theme: options.widgetTheme,
  });
}
