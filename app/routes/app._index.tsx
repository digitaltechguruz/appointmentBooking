import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useMemo } from "react";
import { authenticate } from "../shopify.server";
import { getOrCreateMerchant } from "../models/merchant.server";
import { syncMerchantSubscriptionFromShopify } from "../lib/billing/billing.server";
import { getDashboardStats } from "../models/booking.server";
import { getGoogleConnection } from "../lib/integrations/google/calendar.server";
import { getZoomConnection } from "../lib/integrations/zoom/meetings.server";
import { formatTimezoneShort } from "../lib/booking/timezone";
import { getStorefrontThemeEditorLinks } from "../lib/widget/storefront-theme-links.server";
import {
  getSetupGuide,
  markSetupStepComplete,
  SETUP_STEP_IDS,
  type SetupGuideData,
  type SetupStepId,
} from "../lib/setup-guide/setup-guide.server";
import { SetupGuide } from "../components/admin/SetupGuide";
import { useAdminI18n } from "../lib/admin-i18n";
import type { Booking, Customer, MeetingType, Service } from "@prisma/client";
import dashboardStyles from "../components/admin/dashboard.css?url";

export const links = () => [{ rel: "stylesheet", href: dashboardStyles }];

type RecentBooking = Booking & {
  service: Service;
  customer: Customer;
  meetingType: MeetingType;
};

type LoaderData = {
  stats: {
    confirmedThisMonth: number;
    activeServices: number;
    activeMeetingTypes: number;
    recentBookings: RecentBooking[];
  };
  timezone: string;
  googleConnected: boolean;
  zoomConnected: boolean;
  themeEditor: {
    addBlock: string;
    appEmbeds: string;
  };
  setupGuide: SetupGuideData;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  try {
    await syncMerchantSubscriptionFromShopify(
      merchant.id,
      request,
      billing,
      admin,
    );
  } catch (error) {
    console.warn("[dashboard] billing sync:", error);
  }

  const syncedMerchant = await getOrCreateMerchant(session.shop);
  const merchantId = syncedMerchant.id;

  const [stats, google, zoom, setupGuide] = await Promise.all([
    getDashboardStats(merchantId),
    getGoogleConnection(merchantId),
    getZoomConnection(merchantId),
    getSetupGuide(merchantId, {
      setupGuideState: syncedMerchant.setupGuideState,
      widgetContent: syncedMerchant.widgetContent,
      widgetTheme: syncedMerchant.widgetTheme,
    }, { admin, shop: session.shop }),
  ]);
  return {
    stats,
    timezone: syncedMerchant.timezone ?? "UTC",
    googleConnected: Boolean(google),
    zoomConnected: Boolean(zoom),
    themeEditor: getStorefrontThemeEditorLinks(session.shop),
    setupGuide,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "markSetupStep") {
    const stepId = String(formData.get("stepId") ?? "");
    if (!SETUP_STEP_IDS.includes(stepId as SetupStepId)) {
      return { ok: false };
    }
    await markSetupStepComplete(merchant.id, stepId as SetupStepId);
    return { ok: true };
  }

  return { ok: false };
};

export default function AppointmentBookingHome() {
  const { stats, timezone, googleConnected, zoomConnected, themeEditor, setupGuide } =
    useLoaderData<LoaderData>();
  const { t, locale } = useAdminI18n();

  const quickSetupItems = useMemo(
    () => [
      {
        to: "/app/settings/languages",
        titleKey: "dashboard.quickSetupSettingsTitle",
        descKey: "dashboard.quickSetupSettingsDesc",
        iconClass: "ab-home__quick-icon--settings",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        to: "/app/services",
        titleKey: "dashboard.quickSetupServicesTitle",
        descKey: "dashboard.quickSetupServicesDesc",
        iconClass: "ab-home__quick-icon--services",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        to: "/app/availability",
        titleKey: "dashboard.quickSetupAvailabilityTitle",
        descKey: "dashboard.quickSetupAvailabilityDesc",
        iconClass: "ab-home__quick-icon--availability",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: "/app/meeting-types",
        titleKey: "dashboard.quickSetupMeetingTypesTitle",
        descKey: "dashboard.quickSetupMeetingTypesDesc",
        iconClass: "ab-home__quick-icon--meeting",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        to: "/app/bookings",
        titleKey: "dashboard.quickSetupBookingsTitle",
        descKey: "dashboard.quickSetupBookingsDesc",
        iconClass: "ab-home__quick-icon--bookings",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
    [],
  );

  function formatBookingDate(date: Date) {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatBookingTimeRange(startTime: string, endTime: string, timeZone: string) {
    return `${startTime} – ${endTime} (${formatTimezoneShort(timeZone)})`;
  }

  function statusClass(status: string) {
    if (status === "CONFIRMED") return "ab-home__status--confirmed";
    return "ab-home__status--cancelled";
  }

  function formatStatus(status: string) {
    if (status === "CONFIRMED") return t("common.confirmed");
    if (status === "CANCELLED") return t("common.cancelled");
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  const connectedCount = Number(googleConnected) + Number(zoomConnected);

  return (
    <s-page heading={t("dashboard.pageTitle")}>
      <div className="ab-home">
        <div className="ab-home__stats">
          <Link to="/app/bookings" className="ab-home__stat ab-home__stat--link ab-home__stat--accent">
            <div className="ab-home__stat-value">{stats.confirmedThisMonth}</div>
            <div className="ab-home__stat-label">{t("dashboard.statMonthBookings")}</div>
          </Link>
          <Link to="/app/services" className="ab-home__stat ab-home__stat--link">
            <div className="ab-home__stat-value">{stats.activeServices}</div>
            <div className="ab-home__stat-label">{t("dashboard.statActiveServices")}</div>
          </Link>
          <Link to="/app/meeting-types" className="ab-home__stat ab-home__stat--link">
            <div className="ab-home__stat-value">{stats.activeMeetingTypes}</div>
            <div className="ab-home__stat-label">{t("dashboard.statActiveTypes")}</div>
          </Link>
        </div>

        <SetupGuide guide={setupGuide} themeEditor={themeEditor} />

        <section className="ab-home__panel ab-home__panel--quick">
          <div className="ab-home__panel-head">
            <div>
              <h2 className="ab-home__panel-title">{t("dashboard.quickSetupTitle")}</h2>
              <p className="ab-home__panel-subtitle">{t("dashboard.quickSetupSubtitle")}</p>
            </div>
          </div>
          <div className="ab-home__panel-body ab-home__panel-body--quick">
            <div className="ab-home__quick-grid">
              {quickSetupItems.map((item) => (
                <Link key={item.to} to={item.to} className="ab-home__quick-card">
                  <span className={`ab-home__quick-icon ${item.iconClass}`}>{item.icon}</span>
                  <span className="ab-home__quick-body">
                    <span className="ab-home__quick-title">{t(item.titleKey)}</span>
                    <span className="ab-home__quick-desc">{t(item.descKey)}</span>
                  </span>
                  <span className="ab-home__quick-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="ab-home__stack">
          <section className="ab-home__panel">
            <div className="ab-home__panel-head">
              <h2 className="ab-home__panel-title">{t("dashboard.integrationsTitle")}</h2>
              <Link to="/app/settings/integrations" className="ab-home__panel-link">
                {t("dashboard.manageIntegrations")}
              </Link>
            </div>
            <div className="ab-home__panel-body">
              <p className="ab-home__integrations-summary">
                {connectedCount === 2
                  ? t("dashboard.integrationsAllConnected")
                  : connectedCount === 1
                    ? t("dashboard.integrationsPartialConnected")
                    : t("dashboard.integrationsNoneConnected")}
              </p>
              <ul className="ab-home__integrations-status">
                <li>
                  {t("dashboard.googleCalendarTitle")}:{" "}
                  {googleConnected ? t("common.connected") : t("common.notConnected")}
                </li>
                <li>
                  {t("dashboard.zoomTitle")}:{" "}
                  {zoomConnected ? t("common.connected") : t("common.notConnected")}
                </li>
              </ul>
            </div>
          </section>

          <section className="ab-home__panel">
            <div className="ab-home__panel-head">
              <h2 className="ab-home__panel-title">{t("dashboard.upcomingBookingsTitle")}</h2>
              <Link to="/app/bookings" className="ab-home__panel-link">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            {stats.recentBookings.length === 0 ? (
              <div className="ab-home__empty">{t("dashboard.emptyBookings")}</div>
            ) : (
              <div className="ab-home__panel-body--flush">
                <table className="ab-home__table">
                  <thead>
                    <tr>
                      <th>{t("dashboard.tableCustomer")}</th>
                      <th>{t("dashboard.tableService")}</th>
                      <th>{t("dashboard.tableMeeting")}</th>
                      <th>{t("dashboard.tableWhen")}</th>
                      <th>{t("dashboard.tableStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <div className="ab-home__customer">
                            {booking.customer.firstName} {booking.customer.lastName}
                          </div>
                        </td>
                        <td>{booking.service.name}</td>
                        <td>{booking.meetingType.name}</td>
                        <td>
                          <div className="ab-home__when">
                            {formatBookingDate(booking.bookingDate)}
                          </div>
                          <div className="ab-home__when-time">
                            {formatBookingTimeRange(
                              booking.startTime,
                              booking.endTime,
                              timezone,
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`ab-home__status ${statusClass(booking.status)}`}
                          >
                            {formatStatus(booking.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
