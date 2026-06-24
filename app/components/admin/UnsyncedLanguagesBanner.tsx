import { AppLink } from "./AppLink";
import { useAdminI18n } from "../../lib/admin-i18n";

type UnsyncedLocale = {
  locale: string;
  name: string;
  label?: string;
};

type Props = {
  locales: UnsyncedLocale[];
};

export function UnsyncedLanguagesBanner({ locales }: Props) {
  const { t } = useAdminI18n();

  if (!locales?.length) return null;

  const names = locales.map((row) => row.label || row.name).join(", ");

  return (
    <div className="ab-unsynced-banner">
      <s-banner tone="warning">
        <s-stack direction="block" gap="small">
          <s-paragraph>
            {t("banner.unsyncedMessage", { names })}
          </s-paragraph>
          <AppLink to="/app/settings">
            <s-button variant="secondary">{t("banner.goToSettings")}</s-button>
          </AppLink>
        </s-stack>
      </s-banner>
    </div>
  );
}
