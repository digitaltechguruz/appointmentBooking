import { Outlet, useLoaderData, useRouteError } from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { useAppHref, useEmbeddedUrlCleanup } from "../lib/useAppHref";
import { loadAdminMessages, resolveAdminLocale } from "../lib/admin-i18n.server.js";
import { AdminI18nProvider, useAdminI18n } from "../lib/admin-i18n";
import { AdminLocaleSync } from "../components/admin/AdminLocaleSync";
import { UnsyncedLanguagesBanner } from "../components/admin/UnsyncedLanguagesBanner";
import "../components/admin/dashboard.css";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const adminLocale = resolveAdminLocale(request, session);
  const adminMessages = await loadAdminMessages(adminLocale, {
    admin,
    shopDomain: session.shop,
  });

  if (admin?.graphql) {
    void import("../lib/dashboard/dashboard-i18n-metaobject.server.js")
      .then(({ syncDashboardDefinitionLabels }) =>
        syncDashboardDefinitionLabels(admin, adminLocale, session.shop),
      )
      .catch((error) => {
        console.warn("[app] dashboard definition labels:", error?.message || error);
      });

    void import("../lib/widget/booking-widget-i18n-metaobject.server.js")
      .then(({ syncWidgetDefinitionLabels }) =>
        syncWidgetDefinitionLabels(admin, adminLocale, session.shop),
      )
      .catch((error) => {
        console.warn("[app] widget definition labels:", error?.message || error);
      });
  }

  let unsyncedLocales = [];
  if (admin?.graphql) {
    try {
      const { fetchUnsyncedLocalesForBanner } = await import(
        "../lib/widget/widget-languages.server"
      );
      unsyncedLocales = await fetchUnsyncedLocalesForBanner(admin, session.shop);
    } catch (error) {
      console.warn("[app] unsynced locales:", error);
    }
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    adminLocale,
    adminMessages,
    unsyncedLocales,
  };
};

function AppNavLink({ to, rel, children }) {
  const href = useAppHref(to);

  return (
    <a href={href} rel={rel}>
      {children}
    </a>
  );
}

function AppNav() {
  const { t } = useAdminI18n();

  return (
    <NavMenu>
      <AppNavLink to="/app" rel="home">
        {t("nav.dashboard")}
      </AppNavLink>
      <AppNavLink to="/app/services">{t("nav.services")}</AppNavLink>
      <AppNavLink to="/app/availability">{t("nav.availability")}</AppNavLink>
      <AppNavLink to="/app/meeting-types">{t("nav.meetingTypes")}</AppNavLink>
      <AppNavLink to="/app/bookings">{t("nav.bookings")}</AppNavLink>
      <AppNavLink to="/app/settings">{t("nav.settings")}</AppNavLink>
      <AppNavLink to="/app/billing">{t("nav.billing")}</AppNavLink>
    </NavMenu>
  );
}

export default function App() {
  const { apiKey, adminLocale, adminMessages, unsyncedLocales } = useLoaderData();
  useEmbeddedUrlCleanup();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <AdminI18nProvider locale={adminLocale} messages={adminMessages}>
        <AdminLocaleSync serverLocale={adminLocale} />
        <AppNav />
        <div className="ab-app-shell">
          <UnsyncedLanguagesBanner locales={unsyncedLocales} />
          <Outlet />
        </div>
      </AdminI18nProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
