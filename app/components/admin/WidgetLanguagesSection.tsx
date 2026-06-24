import { useEffect } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useAdminI18n } from "../../lib/admin-i18n";
import { SUPPORTED_LANGUAGES } from "../../lib/widget/widget-text.constants.js";
import { showAppToast, useFetcherIdleResult } from "../../lib/admin/toast";

type LocaleRow = {
  locale: string;
  name: string;
  primary: boolean;
  appSupported: boolean;
  appLanguage?: string | null;
  appLanguageLabel?: string | null;
  widgetTextSynced: boolean;
  editWidgetMetaobjectUrl: string | null;
};

type Props = {
  locales: LocaleRow[];
  localesError: string | null;
  provisionError: string | null;
  defaultMetaobjectId: string | null;
  metaobjectDefinitionName: string;
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

export function WidgetLanguagesSection({
  locales,
  localesError,
  provisionError,
  defaultMetaobjectId,
  metaobjectDefinitionName,
}: Props) {
  const { t } = useAdminI18n();
  const fetcher = useFetcher<{ ok?: boolean; message?: string; error?: string }>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const syncingLocale = fetcher.formData?.get("locale")?.toString();
  const isBusy = fetcher.state !== "idle";

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data === "object" && data != null && "ok" in data) {
      if (data.ok && data.message) {
        showAppToast(shopify, data.message);
      } else if (!data.ok && data.error) {
        showAppToast(shopify, data.error, { isError: true });
      }
    }
  });

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  function handleSync(locale: string) {
    const fd = new FormData();
    fd.set("intent", "syncLocale");
    fd.set("locale", locale);
    fetcher.submit(fd, { method: "post" });
  }

  function handleEdit(editUrl: string | null) {
    if (!defaultMetaobjectId) {
      showAppToast(shopify, t("toast.entryMissing"), { isError: true });
      return;
    }
    if (editUrl) {
      openExternalAdminUrl(editUrl);
    } else {
      showAppToast(shopify, t("toast.translateAdaptFailed"), { isError: true });
    }
  }

  function languageLabel(code: string | null | undefined) {
    if (!code) return null;
    const key = `languages.lang.${code}`;
    const label = t(key);
    return label === key ? code : label;
  }

  return (
    <div className="ab-languages">
      {provisionError ? (
        <div className="ab-languages__warning">
          {provisionError} {t("languages.provisionRetry")}
        </div>
      ) : null}

      <div className="ab-languages__callout">
        <h4 className="ab-languages__callout-heading">{metaobjectDefinitionName}</h4>
        <p className="ab-languages__callout-text">
          {t("languages.supportedHelp", {
            metaobjectName: metaobjectDefinitionName,
            sync: t("languages.syncTranslation"),
            edit: t("languages.editTranslation"),
          })}
        </p>
        <div className="ab-languages__chip-row" aria-label={t("languages.supportedTitle")}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <span key={lang.value} className="ab-languages__chip">
              {t(`languages.lang.${lang.value}`)}
            </span>
          ))}
        </div>
      </div>

      {locales.length === 0 ? (
        <div className="ab-languages__empty">
          {localesError || t("languages.noLocalesDefault")}
        </div>
      ) : (
        <div className="ab-languages__list">
          {locales.map((row) => (
            <div key={row.locale} className="ab-languages__row">
              <div className="ab-languages__row-main">
                <div className="ab-languages__row-title">
                  <span className="ab-languages__locale-name">{row.name}</span>
                  <span className="ab-languages__locale-code">{row.locale}</span>
                  {row.appSupported ? (
                    <span
                      className={`ab-languages__status-pill ${
                        row.widgetTextSynced
                          ? "ab-languages__status-pill--ok"
                          : "ab-languages__status-pill--pending"
                      }`}
                    >
                      {row.widgetTextSynced
                        ? t("languages.synced")
                        : t("languages.notSynced")}
                    </span>
                  ) : null}
                </div>
                <div className="ab-languages__badges">
                  {row.primary ? (
                    <span className="ab-languages__badge ab-languages__badge--primary">
                      {t("languages.badgePrimary")}
                    </span>
                  ) : null}
                  {row.appSupported ? (
                    <span className="ab-languages__badge ab-languages__badge--supported">
                      {t("languages.badgeSupported")}
                      {row.appLanguageLabel
                        ? ` · ${row.appLanguageLabel}`
                        : languageLabel(row.appLanguage)
                          ? ` · ${languageLabel(row.appLanguage)}`
                          : ""}
                    </span>
                  ) : (
                    <span className="ab-languages__badge ab-languages__badge--other">
                      {t("languages.badgeTranslateShopify")}
                    </span>
                  )}
                </div>
              </div>
              <div className="ab-languages__actions">
                <s-button
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => handleEdit(row.editWidgetMetaobjectUrl)}
                >
                  {t("languages.editTranslation")}
                </s-button>
                {row.appSupported ? (
                  <s-button
                    variant="secondary"
                    disabled={isBusy}
                    onClick={() => handleSync(row.locale)}
                  >
                    {isBusy && syncingLocale === row.locale
                      ? t("languages.syncing")
                      : row.widgetTextSynced
                        ? t("languages.resetTranslation")
                        : t("languages.syncTranslation")}
                  </s-button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
