import { useAdminI18n } from "../../lib/admin-i18n";

type Props = {
  unsyncedLocaleLabels: string[];
  metaobjectDefinitionName: string;
  hasAnyUnsynced: boolean;
};

export function CatalogTranslationsBanner({
  unsyncedLocaleLabels,
  metaobjectDefinitionName,
  hasAnyUnsynced,
}: Props) {
  const { t } = useAdminI18n();

  if (!hasAnyUnsynced || unsyncedLocaleLabels.length === 0) return null;

  const names = unsyncedLocaleLabels.join(", ");

  return (
    <div className="ab-unsynced-banner">
      <s-banner tone="warning">
        <s-stack direction="block" gap="small">
          <s-paragraph>
            {t("catalog.missingTranslationsBanner", {
              names,
              metaobjectName: metaobjectDefinitionName,
            })}
          </s-paragraph>
        </s-stack>
      </s-banner>
    </div>
  );
}
