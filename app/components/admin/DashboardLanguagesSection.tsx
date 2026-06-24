import { useMemo, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useAdminI18n } from "../../lib/admin-i18n";
import { getDashboardFieldGuide } from "../../lib/dashboard/dashboard-i18n-messages.shared.js";
import { showAppToast, useFetcherIdleResult } from "../../lib/admin/toast";

type Props = {
  dashboardReady: boolean;
  dashboardProvisionError: string | null;
  dashboardMetaobjectAdminUrl: string | null;
  dashboardMetaobjectName: string;
};

function openExternalAdminUrl(url: string) {
  if (!url || !/^https:\/\/admin\.shopify\.com\//i.test(url)) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function DashboardLanguagesSection({
  dashboardReady,
  dashboardProvisionError,
  dashboardMetaobjectAdminUrl,
  dashboardMetaobjectName,
}: Props) {
  const { t, locale } = useAdminI18n();
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const fetcher = useFetcher<{ ok?: boolean; message?: string; error?: string }>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const isResetting =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent")?.toString() === "resetDashboardText";
  const isBusy = fetcher.state !== "idle";
  const dashboardFieldGuide = useMemo(() => getDashboardFieldGuide(t), [t]);
  const adminLanguageLabel =
    t(`languages.lang.${locale}`) || locale.toUpperCase();

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data === "object" && data != null && "ok" in data) {
      if (data.ok && data.message) {
        showAppToast(shopify, data.message);
        revalidator.revalidate();
      } else if (!data.ok && data.error) {
        showAppToast(shopify, data.error, { isError: true });
      }
    }
  });

  function handleResetDefaults() {
    const fd = new FormData();
    fd.set("intent", "resetDashboardText");
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="ab-languages ab-languages--dashboard">
      {dashboardProvisionError ? (
        <div className="ab-languages__warning">{dashboardProvisionError}</div>
      ) : null}

      <div className="ab-dashboard-block">
        <div className="ab-dashboard-block__intro">
          <div className="ab-dashboard-block__intro-text">
            <div className="ab-dashboard-block__title-row">
              <h4 className="ab-languages__callout-heading">{dashboardMetaobjectName}</h4>
              {dashboardReady ? (
                <span className="ab-languages__status-pill ab-languages__status-pill--ok">
                  {t("languages.dashboardReadyLabel")}
                </span>
              ) : null}
            </div>
            <p className="ab-languages__callout-text ab-languages__callout-text--flush">
              {t("languages.dashboardLanguagesNotice", {
                metaobjectName: dashboardMetaobjectName,
                locale: adminLanguageLabel,
              })}
            </p>
          </div>
          <div className="ab-dashboard-block__actions">
            {dashboardMetaobjectAdminUrl ? (
              <s-button
                variant="primary"
                disabled={isBusy}
                onClick={() => openExternalAdminUrl(dashboardMetaobjectAdminUrl)}
              >
                {t("languages.openDashboardMetaobject")}
              </s-button>
            ) : null}
            <s-button
              variant="secondary"
              disabled={isBusy}
              onClick={handleResetDefaults}
            >
              {isResetting
                ? t("languages.resettingDashboard")
                : t("languages.resetDashboardDefaults")}
            </s-button>
          </div>
        </div>

        <p className="ab-dashboard-block__locale">
          <span className="ab-dashboard-block__locale-label">
            {t("languages.dashboardAdminLanguage")}
          </span>
          <span className="ab-dashboard-block__locale-value">{adminLanguageLabel}</span>
        </p>

        <div className="ab-dashboard-block__fields">
          <button
            type="button"
            className="ab-dashboard-block__fields-toggle"
            aria-expanded={fieldsOpen}
            onClick={() => setFieldsOpen((open) => !open)}
          >
            <span>{t("languages.dashboardFieldsTitle")}</span>
            <span className="ab-dashboard-block__fields-chevron" aria-hidden>
              {fieldsOpen ? "−" : "+"}
            </span>
          </button>
          {fieldsOpen ? (
            <div className="ab-dashboard-block__field-grid">
              {dashboardFieldGuide.map((section) => (
                <div key={section.key} className="ab-dashboard-block__field-item">
                  <span className="ab-dashboard-block__field-name">{section.label}</span>
                  <span className="ab-dashboard-block__field-desc">{section.description}</span>
                </div>
              ))}
              <p className="ab-dashboard-block__field-hint">{t("languages.dashboardEditHint")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
