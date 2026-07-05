import { useAppBridge } from "@shopify/app-bridge-react";
import { useAdminI18n } from "../../lib/admin-i18n";
import { showAppToast } from "../../lib/admin/toast";
import type { CatalogEntityTranslationRow } from "../../lib/widget/catalog-languages.server";
import "./languages.css";

type Props = {
  entity: CatalogEntityTranslationRow | null | undefined;
  metaobjectDefinitionName: string;
  embedded?: boolean;
  translatableFieldLabels?: string[];
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

function LocaleIcon({ primary }: { primary: boolean }) {
  return (
    <span
      className={`ab-languages__locale-icon${primary ? " ab-languages__locale-icon--primary" : ""}`}
      aria-hidden
    >
      {primary ? "★" : "🌐"}
    </span>
  );
}

export function CatalogEntityTranslations({
  entity,
  metaobjectDefinitionName,
  embedded = false,
  translatableFieldLabels = [],
}: Props) {
  const { t } = useAdminI18n();
  const shopify = useAppBridge();

  if (!entity) return null;

  const syncedCount = entity.localeRows.filter((row) => row.synced).length;
  const totalCount = entity.localeRows.length;
  const pendingCount = entity.localeRows.filter(
    (row) => !row.synced && !row.primary,
  ).length;

  function handleEdit(editUrl: string | null) {
    if (!entity?.metaobjectId) {
      showAppToast(shopify, t("catalog.entryMissing"), { isError: true });
      return;
    }
    if (editUrl) {
      openExternalAdminUrl(editUrl);
    } else {
      showAppToast(shopify, t("toast.translateAdaptFailed"), { isError: true });
    }
  }

  return (
    <div className={embedded ? "ab-services-accordion__content" : "ab-services__detail-section"}>
      {!embedded ? (
        <h3 className="ab-services__detail-heading">{t("catalog.translationsTitle")}</h3>
      ) : null}

      <div className="ab-languages">
        <div className="ab-languages__summary">
          <div className="ab-languages__summary-main">
            <p className="ab-languages__summary-title">
              {t("catalog.translationsSyncSummary", {
                synced: syncedCount,
                total: totalCount,
              })}
            </p>
            {pendingCount > 0 ? (
              <p className="ab-languages__summary-alert">
                {t("catalog.translationsNeedsAttention", { count: pendingCount })}
              </p>
            ) : (
              <p className="ab-languages__summary-ok">{t("catalog.translationsAllSynced")}</p>
            )}
          </div>
          <div className="ab-languages__summary-meta">
            <span className="ab-languages__callout-tag">{metaobjectDefinitionName}</span>
          </div>
        </div>

        {translatableFieldLabels.length > 0 ? (
          <div className="ab-languages__fields-block">
            <p className="ab-languages__fields-label">{t("catalog.translationsFieldsLabel")}</p>
            <div className="ab-languages__chip-row">
              {translatableFieldLabels.map((label) => (
                <span key={label} className="ab-languages__chip">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <ol className="ab-languages__steps">
          <li>{t("catalog.translationsStepSave")}</li>
          <li>{t("catalog.translationsStepTranslate")}</li>
        </ol>

        {!entity.metaobjectId ? (
          <div className="ab-languages__warning">{t("catalog.saveToCreateEntry")}</div>
        ) : (
          <div className="ab-languages__list">
            {entity.localeRows.map((row) => (
              <div
                key={row.locale}
                className={`ab-languages__row${row.primary ? " ab-languages__row--primary" : ""}${!row.synced && !row.primary ? " ab-languages__row--pending" : ""}`}
              >
                <div className="ab-languages__row-main">
                  <div className="ab-languages__row-title">
                    <LocaleIcon primary={row.primary} />
                    <span className="ab-languages__locale-name">{row.name}</span>
                    <span className="ab-languages__locale-code">{row.locale}</span>
                    <span
                      className={`ab-languages__status-pill ${
                        row.synced
                          ? "ab-languages__status-pill--ok"
                          : "ab-languages__status-pill--pending"
                      }`}
                    >
                      {row.synced ? t("languages.synced") : t("languages.notSynced")}
                    </span>
                  </div>
                  <div className="ab-languages__badges">
                    {row.primary ? (
                      <>
                        <span className="ab-languages__badge ab-languages__badge--primary">
                          {t("languages.badgePrimary")}
                        </span>
                        <span className="ab-languages__row-hint">
                          {t("catalog.translationsPrimaryHint")}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="ab-languages__actions">
                  <s-button
                    variant={row.synced ? "secondary" : "primary"}
                    onClick={() => handleEdit(row.editUrl)}
                  >
                    {t("languages.editTranslation")}
                  </s-button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
