import { Outlet } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { SettingsSidebar } from "../components/admin/SettingsSidebar";
import { useAdminI18n } from "../lib/admin-i18n";
import settingsStyles from "../components/admin/settings.css?url";
import languagesStyles from "../components/admin/languages.css?url";
import dashboardStyles from "../components/admin/dashboard.css?url";

export const links = () => [
  { rel: "stylesheet", href: settingsStyles },
  { rel: "stylesheet", href: languagesStyles },
  { rel: "stylesheet", href: dashboardStyles },
];

export default function SettingsLayout() {
  const { t } = useAdminI18n();

  return (
    <s-page heading={t("settings.pageTitle")}>
      <div className="ab-settings-layout">
        <SettingsSidebar />
        <div className="ab-settings-layout__content">
          <Outlet />
        </div>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
