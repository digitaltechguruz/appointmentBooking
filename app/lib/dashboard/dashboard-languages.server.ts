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

async function loadDashboardHelpers() {
  return import("./dashboard-i18n-metaobject.server.js");
}

export async function loadDashboardLanguagesStatus(
  admin: AdminClient,
  session: AdminSession,
  adminLocale: string,
) {
  const {
    getDashboardTextSummary,
    translateAndAdaptDashboardMetaobjectUrl,
  } = await loadDashboardHelpers();
  const {
    fetchAllShopLocales,
    fetchShopAdminHandle,
    shopifyMetaobjectEntryAdminUrl,
  } = await import("../widget/booking-widget-i18n-metaobject.server.js");

  const shop = session.shop;
  const [summary, storeHandle, { locales }] = await Promise.all([
    getDashboardTextSummary(admin, shop),
    fetchShopAdminHandle(admin, shop),
    fetchAllShopLocales(admin, shop),
  ]);

  const dashboardMetaobjectId = summary.metaobjectId || null;
  const dashboardMetaobjectType = summary.definitionType || null;
  const primaryLocale = locales.find((row: { primary?: boolean }) => row.primary)?.locale || null;

  return {
    dashboardMetaobjectId,
    dashboardMetaobjectType,
    dashboardMetaobjectAdminUrl: shopifyMetaobjectEntryAdminUrl(
      storeHandle,
      dashboardMetaobjectType,
      dashboardMetaobjectId,
    ),
    dashboardReady: Boolean(dashboardMetaobjectId && summary.ok),
    dashboardProvisionError: summary.ok
      ? null
      : summary.error || "Dashboard text entry is not ready yet.",
    editDashboardMetaobjectUrl: translateAndAdaptDashboardMetaobjectUrl(
      storeHandle,
      primaryLocale || adminLocale,
      dashboardMetaobjectId,
    ),
  };
}

export async function resetDashboardTextAction(
  admin: AdminClient,
  session: AdminSession,
  adminLocale: string,
) {
  const { resetDashboardTextDefaults, provisionDashboardTextMetaobject } =
    await loadDashboardHelpers();

  const summary = await provisionDashboardTextMetaobject(admin, {
    shopDomain: session.shop,
    skipIfReady: false,
    uiLocale: adminLocale,
  });

  if (!summary.ok) {
    return { ok: false, error: summary.error || "Dashboard provisioning failed" };
  }

  const result = await resetDashboardTextDefaults(
    admin,
    session.shop,
    adminLocale,
  );

  return {
    ok: true,
    message: `Dashboard text reset for ${result.locale || adminLocale}.`,
  };
}

export async function ensureDashboardTextOnInstall(
  admin: AdminClient,
  session: AdminSession,
  uiLocale: string,
) {
  const { provisionDashboardTextMetaobject } = await loadDashboardHelpers();
  return provisionDashboardTextMetaobject(admin, {
    shopDomain: session.shop,
    skipIfReady: true,
    uiLocale,
  });
}
