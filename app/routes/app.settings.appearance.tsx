import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { WidgetTheme } from "@prisma/client";
import { requireAdminMerchant } from "../lib/auth.server";
import { updateMerchantSettings } from "../models/merchant.server";
import { parseWidgetTheme } from "../lib/widget/themes.shared";
import { WidgetThemeStepPreview } from "../components/admin/WidgetThemeStepPreview";
import { useAdminI18n } from "../lib/admin-i18n";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  return {
    widgetTheme: merchant.widgetTheme ?? "CLASSIC",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-widget-theme") {
    const theme = parseWidgetTheme(formData.get("widgetTheme"));
    await updateMerchantSettings(merchant.id, { widgetTheme: theme });
    return { ok: true, intent, widgetTheme: theme };
  }

  return { ok: false };
};

export default function SettingsAppearancePage() {
  const { t } = useAdminI18n();
  const { widgetTheme } = useLoaderData<typeof loader>();
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
    <section className="ab-settings-layout__panel">
      <header className="ab-settings-layout__panel-head">
        <h2 className="ab-settings-layout__panel-title">
          {t("settings.storefrontAppearanceTitle")}
        </h2>
        <p className="ab-settings-layout__panel-desc">
          {t("settings.storefrontAppearanceDesc")}
        </p>
      </header>

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
  );
}

export const headers = boundary.headers;
