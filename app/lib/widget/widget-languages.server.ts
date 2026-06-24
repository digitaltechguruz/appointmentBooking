import { SUPPORTED_LANGUAGES } from "./widget-text.constants.js";

type AdminSession = {
  shop: string;
  scope?: string | null;
};

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

async function loadMetaobjectHelpers() {
  return import("./booking-widget-i18n-metaobject.server.js");
}

async function buildLocalesPayload(
  admin: AdminClient,
  session: AdminSession,
  summary: {
    metaobjectId: string | null;
    definitionType: string | null;
  },
) {
  const {
    fetchAllShopLocales,
    fetchShopAdminHandle,
    isWidgetTextSyncedForShopLocale,
    translateAndAdaptMetaobjectUrl,
    MERCHANT_WIDGET_TEXT_TYPE,
  } = await loadMetaobjectHelpers();

  const shop = session.shop;
  const [{ locales, error: localesError }, storeHandle] = await Promise.all([
    fetchAllShopLocales(admin, shop),
    fetchShopAdminHandle(admin, shop),
  ]);

  const defaultMetaobjectId = summary.metaobjectId || null;
  const metaobjectType = summary.definitionType || MERCHANT_WIDGET_TEXT_TYPE;
  const primaryLocale = locales.find((row) => row.primary)?.locale || null;

  const syncStatuses = await Promise.all(
    locales.map(async (row) => ({
      locale: row.locale,
      widgetTextSynced: row.appSupported
        ? await isWidgetTextSyncedForShopLocale(admin, row.locale, shop)
        : false,
    })),
  );
  const syncedByLocale = Object.fromEntries(
    syncStatuses.map((status) => [status.locale, status]),
  );

  return {
    locales: locales.map((row) => {
      const sync = syncedByLocale[row.locale] || {};
      return {
        ...row,
        widgetTextSynced: sync.widgetTextSynced ?? false,
        editWidgetMetaobjectUrl: translateAndAdaptMetaobjectUrl(
          storeHandle,
          row.locale,
          defaultMetaobjectId,
        ),
      };
    }),
    localesError,
    defaultMetaobjectId,
    metaobjectType,
    metaobjectDefinitionName: "Book appointment widget text",
    primaryLocale,
    supportedLanguageLabels: SUPPORTED_LANGUAGES.map((l) => l.label).join(", "),
  };
}

/** Fast path for Settings — read sync status only; no provisioning on load. */
export async function loadWidgetLanguagesSyncStatus(
  admin: AdminClient,
  session: AdminSession,
) {
  const { getWidgetTextSummary } = await loadMetaobjectHelpers();
  const summary = await getWidgetTextSummary(admin, session.shop);

  return {
    ...(await buildLocalesPayload(admin, session, summary)),
    provisionError: summary.ok
      ? null
      : "Widget text entry is empty. Click Sync translation below to load defaults.",
  };
}

/** Full provisioning — used on sync action or background jobs only. */
export async function loadWidgetLanguagesPageData(
  admin: AdminClient,
  session: AdminSession,
) {
  const {
    getWidgetTextSummary,
    invalidateWidgetTextShopCache,
    provisionWidgetTextMetaobject,
    ensureWidgetTextContentPopulated,
  } = await loadMetaobjectHelpers();
  const { invalidateShopCache } = await import("../shop-cache.server.js");

  const shop = session.shop;
  invalidateShopCache(shop, "widget-summary");
  invalidateShopCache(shop, "unsynced-widget-locales");
  invalidateWidgetTextShopCache(shop);

  let provisionError: string | null = null;

  try {
    await ensureWidgetTextContentPopulated(admin, shop);
  } catch (error) {
    provisionError =
      error instanceof Error ? error.message : "Could not seed widget text entry";
  }

  invalidateWidgetTextShopCache(shop);
  let summary = await getWidgetTextSummary(admin, shop);

  if (!summary.ok && !provisionError) {
    const provision = await provisionWidgetTextMetaobject(admin, {
      shopDomain: shop,
      scope: session.scope,
      skipIfReady: false,
      uiLocale: "en",
    });
    provisionError = provision.ok ? null : provision.error ?? "Provisioning failed";
    invalidateWidgetTextShopCache(shop);
    summary = await getWidgetTextSummary(admin, shop);
  }

  return {
    ...(await buildLocalesPayload(admin, session, summary)),
    provisionError,
  };
}

export async function syncWidgetLocaleAction(
  admin: AdminClient,
  session: AdminSession,
  locale: string,
  uiLocale = "en",
) {
  const {
    invalidateWidgetTextShopCache,
    repairWidgetTextMetaobject,
    ensureWidgetTextContentPopulated,
    syncWidgetTextForShopLocale,
    localeToLanguage,
    mapToSupportedLanguage,
  } = await loadMetaobjectHelpers();
  const { invalidateShopCache } = await import("../shop-cache.server.js");

  const appLanguage =
    mapToSupportedLanguage(localeToLanguage(locale)) ||
    mapToSupportedLanguage(uiLocale) ||
    "en";

  invalidateWidgetTextShopCache(session.shop);
  invalidateShopCache(session.shop, "widget-summary");
  invalidateShopCache(session.shop, "unsynced-widget-locales");

  await repairWidgetTextMetaobject(admin, session.shop, {
    uiLocale: appLanguage,
  });
  await ensureWidgetTextContentPopulated(admin, session.shop);

  const result = await syncWidgetTextForShopLocale(admin, locale, session.shop);

  invalidateWidgetTextShopCache(session.shop);
  invalidateShopCache(session.shop, "unsynced-widget-locales");
  invalidateShopCache(session.shop, "widget-summary");

  if (!result.supported) {
    return { ok: false, error: "This locale is not supported for built-in sync." };
  }

  return {
    ok: true,
    message: `Widget text synced for ${result.locale || locale}.`,
  };
}

export async function fetchUnsyncedLocalesForBanner(
  admin: AdminClient,
  shop: string,
) {
  const { fetchUnsyncedWidgetTextLocales } = await loadMetaobjectHelpers();
  return fetchUnsyncedWidgetTextLocales(admin, shop);
}
