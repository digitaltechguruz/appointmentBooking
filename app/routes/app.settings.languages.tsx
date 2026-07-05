import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminMerchant } from "../lib/auth.server";
import { resolveAdminLocale } from "../lib/admin-i18n.server.js";
import {
  loadWidgetLanguagesSyncStatus,
  syncWidgetLocaleAction,
} from "../lib/widget/widget-languages.server";
import { WidgetLanguagesSection } from "../components/admin/WidgetLanguagesSection";
import { DashboardLanguagesSection } from "../components/admin/DashboardLanguagesSection";
import { useAdminI18n } from "../lib/admin-i18n";
import {
  loadDashboardLanguagesStatus,
  resetDashboardTextAction,
} from "../lib/dashboard/dashboard-languages.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await requireAdminMerchant(request);
  const adminLocale = resolveAdminLocale(request, session);

  const {
    getDashboardTextSummary,
    provisionDashboardTextMetaobject,
    invalidateDashboardTextShopCache,
  } = await import("../lib/dashboard/dashboard-i18n-metaobject.server.js");

  let dashboardProvisionError: string | null = null;
  let dashboardSummary = await getDashboardTextSummary(admin, session.shop);
  if (!dashboardSummary.ok) {
    const provision = await provisionDashboardTextMetaobject(admin, {
      shopDomain: session.shop,
      skipIfReady: false,
      uiLocale: adminLocale,
    });
    dashboardProvisionError = provision.ok ? null : provision.error ?? null;
    invalidateDashboardTextShopCache(session.shop);
    dashboardSummary = await getDashboardTextSummary(admin, session.shop);
  }

  const [languages, dashboard] = await Promise.all([
    loadWidgetLanguagesSyncStatus(admin, session),
    loadDashboardLanguagesStatus(admin, session, adminLocale),
  ]);

  return {
    adminLocale,
    ...languages,
    ...dashboard,
    dashboardProvisionError:
      dashboard.dashboardProvisionError || dashboardProvisionError,
    dashboardMetaobjectName: "Dashboard Text",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "syncLocale") {
    const locale = formData.get("locale")?.toString();
    if (!locale) {
      return { ok: false, error: "Missing locale" };
    }
    try {
      const adminLocale = resolveAdminLocale(request, session);
      return await syncWidgetLocaleAction(admin, session, locale, adminLocale);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      return { ok: false, error: message };
    }
  }

  if (intent === "resetDashboardText") {
    const adminLocale = resolveAdminLocale(request, session);
    try {
      return await resetDashboardTextAction(admin, session, adminLocale);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Dashboard reset failed";
      return { ok: false, error: message };
    }
  }

  return { ok: false };
};

export default function SettingsLanguagesPage() {
  const { t } = useAdminI18n();
  const {
    locales,
    localesError,
    provisionError,
    defaultMetaobjectId,
    metaobjectDefinitionName,
    dashboardReady,
    dashboardProvisionError,
    dashboardMetaobjectAdminUrl,
    dashboardMetaobjectName,
  } = useLoaderData<typeof loader>();

  return (
    <section className="ab-settings-layout__panel">
      <header className="ab-settings-layout__panel-head">
        <h2 className="ab-settings-layout__panel-title">{t("settings.languagesTitle")}</h2>
        <p className="ab-settings-layout__panel-desc">{t("settings.languagesDesc")}</p>
      </header>

      <div className="ab-settings__content ab-settings__content--languages">
        <div className="ab-settings__subsection ab-settings__subsection--store">
          <div className="ab-settings__subsection-head">
            <h3 className="ab-settings__subsection-title">
              {t("settings.storeLanguagesTitle")}
            </h3>
            <p className="ab-settings__subsection-desc">
              {t("settings.storeLanguagesDesc")}
            </p>
          </div>
          <WidgetLanguagesSection
            locales={locales}
            localesError={localesError}
            provisionError={provisionError}
            defaultMetaobjectId={defaultMetaobjectId}
            metaobjectDefinitionName={metaobjectDefinitionName}
          />
        </div>

        <div className="ab-settings__subsection-divider" role="separator" />

        <div className="ab-settings__subsection">
          <div className="ab-settings__subsection-head">
            <h3 className="ab-settings__subsection-title">
              {t("languages.dashboardLanguagesTitle")}
            </h3>
            <p className="ab-settings__subsection-desc">
              {t("settings.dashboardLanguagesDesc")}
            </p>
          </div>
          <DashboardLanguagesSection
            dashboardReady={dashboardReady}
            dashboardProvisionError={dashboardProvisionError}
            dashboardMetaobjectAdminUrl={dashboardMetaobjectAdminUrl}
            dashboardMetaobjectName={dashboardMetaobjectName}
          />
        </div>
      </div>
    </section>
  );
}

export const headers = boundary.headers;
