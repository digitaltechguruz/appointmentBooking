import { useAppBridge } from "@shopify/app-bridge-react";
import { useAdminI18n } from "../../lib/admin-i18n";
import { showAppToast } from "../../lib/admin/toast";
import type { CatalogEntityTranslationRow } from "../../lib/widget/catalog-languages.server";
import "./languages.css";

type Props = {
  entity: CatalogEntityTranslationRow | null | undefined;
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

export function CatalogEntityTranslations({
  entity,
  metaobjectDefinitionName,
}: Props) {
  const { t } = useAdminI18n();
  const shopify = useAppBridge();

  if (!entity) return null;

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
    <div className="ab-services__detail-section">
      <h3 className="ab-services__detail-heading">{t("catalog.translationsTitle")}</h3>
      <div className="ab-languages">
        <div className="ab-languages__callout">
          <h4 className="ab-languages__callout-heading">{metaobjectDefinitionName}</h4>
          <p className="ab-languages__callout-text">
            {t("catalog.translationsHelp", {
              metaobjectName: metaobjectDefinitionName,
              edit: t("languages.editTranslation"),
            })}
          </p>
        </div>

        {!entity.metaobjectId ? (
          <div className="ab-languages__warning">
            {t("catalog.saveToCreateEntry")}
          </div>
        ) : (
          <div className="ab-languages__list">
            {entity.localeRows.map((row) => (
              <div key={row.locale} className="ab-languages__row">
                <div className="ab-languages__row-main">
                  <div className="ab-languages__row-title">
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
                      <span className="ab-languages__badge ab-languages__badge--primary">
                        {t("languages.badgePrimary")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="ab-languages__actions">
                  <s-button
                    variant="secondary"
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
