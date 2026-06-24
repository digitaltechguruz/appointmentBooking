import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { WidgetTheme } from "@prisma/client";
import { requireAdminMerchant } from "../lib/auth.server";
import { resolveAdminLocale } from "../lib/admin-i18n.server.js";
import { updateMerchantSettings } from "../models/merchant.server";
import {
  parseWidgetTheme,
} from "../lib/widget/themes.shared";
import {
  loadWidgetLanguagesSyncStatus,
  syncWidgetLocaleAction,
} from "../lib/widget/widget-languages.server";
import { WidgetThemeStepPreview } from "../components/admin/WidgetThemeStepPreview";
import { WidgetLanguagesSection } from "../components/admin/WidgetLanguagesSection";
import { DashboardLanguagesSection } from "../components/admin/DashboardLanguagesSection";
import { useAdminI18n } from "../lib/admin-i18n";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import {
  loadDashboardLanguagesStatus,
  resetDashboardTextAction,
} from "../lib/dashboard/dashboard-languages.server";
import settingsStyles from "../components/admin/settings.css?url";
import languagesStyles from "../components/admin/languages.css?url";

export const links = () => [
  { rel: "stylesheet", href: settingsStyles },
  { rel: "stylesheet", href: languagesStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, merchant } = await requireAdminMerchant(request);
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
    widgetTheme: merchant.widgetTheme ?? "CLASSIC",
    adminLocale,
    ...languages,
    ...dashboard,
    dashboardProvisionError:
      dashboard.dashboardProvisionError || dashboardProvisionError,
    dashboardMetaobjectName: "Dashboard Text",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-widget-theme") {
    const theme = parseWidgetTheme(formData.get("widgetTheme"));
    await updateMerchantSettings(merchant.id, { widgetTheme: theme });
    return { ok: true, intent, widgetTheme: theme };
  }

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

export default function SettingsPage() {
  const { t } = useAdminI18n();
  const {
    widgetTheme,
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
  const themeFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [previewTheme, setPreviewTheme] = useState<WidgetTheme>(widgetTheme);
  const [savedTheme, setSavedTheme] = useState<WidgetTheme>(widgetTheme);

  useEffect(() => {
    setPreviewTheme(widgetTheme);
    setSavedTheme(widgetTheme);
  }, [widgetTheme]);

  useFetcherIdleResult(themeFetcher, (data) => {
    if (
      typeof data === "object" &&
      data != null &&
      "ok" in data &&
      data.ok &&
      "intent" in data &&
      data.intent === "save-widget-theme" &&
      "widgetTheme" in data &&
      typeof data.widgetTheme === "string"
    ) {
      setSavedTheme(data.widgetTheme as WidgetTheme);
      showAppToast(shopify, t("toast.storefrontThemeSaved"));
    }
  });

  const themeOptions = [
    {
      id: "CLASSIC" as const,
      label: t("settings.themeClassic"),
      description: t("settings.themeClassicDesc"),
    },
    {
      id: "MODERN" as const,
      label: t("settings.themeModern"),
      description: t("settings.themeModernDesc"),
    },
  ];

  return (
    <s-page heading={t("settings.pageTitle")}>
      <div className="ab-settings">
        <section className="ab-settings__panel ab-settings__panel--spaced">
          <div className="ab-settings__panel-head">
            <h2 className="ab-settings__panel-title">{t("settings.languagesTitle")}</h2>
            <p className="ab-settings__panel-desc">{t("settings.languagesDesc")}</p>
          </div>

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

        <section className="ab-settings__panel">
          <div className="ab-settings__panel-head">
            <h2 className="ab-settings__panel-title">
              {t("settings.storefrontAppearanceTitle")}
            </h2>
            <p className="ab-settings__panel-desc">
              {t("settings.storefrontAppearanceDesc")}
            </p>
          </div>

          <div className="ab-settings__appearance">
            <div className="ab-settings__appearance-options">
              <div className="ab-settings__theme-options">
                {themeOptions.map((option) => {
                  const selected = previewTheme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`ab-settings__theme-option${selected ? " ab-settings__theme-option--selected" : ""}`}
                      onClick={() => setPreviewTheme(option.id)}
                      aria-pressed={selected}
                    >
                      <span className="ab-settings__theme-option-label">{option.label}</span>
                      <span className="ab-settings__theme-option-desc">{option.description}</span>
                    </button>
                  );
                })}
              </div>

              <themeFetcher.Form method="post" className="ab-settings__theme-form">
                <input type="hidden" name="intent" value="save-widget-theme" />
                <input type="hidden" name="widgetTheme" value={previewTheme} />
                <s-button
                  type="submit"
                  variant="primary"
                  disabled={previewTheme === savedTheme || themeFetcher.state !== "idle"}
                >
                  {themeFetcher.state !== "idle"
                    ? t("common.saving")
                    : t("settings.saveTheme")}
                </s-button>
              </themeFetcher.Form>
            </div>

            <div className="ab-settings__preview">
              <div className="ab-settings__preview-label">{t("settings.previewLabel")}</div>
              <WidgetThemeStepPreview theme={previewTheme} />
            </div>
          </div>
        </section>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
