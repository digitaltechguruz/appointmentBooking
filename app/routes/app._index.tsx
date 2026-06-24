import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useFetcher, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdminMerchant } from "../lib/auth.server";
import { getDashboardStats } from "../models/booking.server";
import {
  getGoogleConnection,
  disconnectGoogle,
} from "../lib/integrations/google/calendar.server";
import {
  getZoomConnection,
  disconnectZoom,
} from "../lib/integrations/zoom/meetings.server";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import { formatTimezoneShort } from "../lib/booking/timezone";
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
  google: { email: string | null } | null;
  zoom: { email: string | null } | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const [stats, google, zoom] = await Promise.all([
    getDashboardStats(merchant.id),
    getGoogleConnection(merchant.id),
    getZoomConnection(merchant.id),
  ]);
  return {
    stats,
    timezone: merchant.timezone ?? "UTC",
    google,
    zoom,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "disconnect-google") await disconnectGoogle(merchant.id);
  if (intent === "disconnect-zoom") await disconnectZoom(merchant.id);
  return { ok: true };
};

function IconGoogleCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M18 4h-1V2h-2v2H9V2H7v2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"
      />
      <path fill="#fff" d="M6 8h12v10H6V8Z" />
      <path fill="#EA4335" d="M12 11h3v3h-3v-3Z" />
      <path fill="#FBBC04" d="M9 11h3v3H9v-3Z" />
      <path fill="#34A853" d="M12 14h3v3h-3v-3Z" />
      <path fill="#4285F4" d="M9 14h3v3H9v-3Z" />
    </svg>
  );
}

function IconZoom() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#2D8CFF" />
      <path
        fill="#fff"
        d="M9.2 8.8v6.4l5.6-3.2-5.6-3.2Zm3.8 3.2-3.8 2.2V9.8l3.8 2.2Zm1.6 0 3.2 1.8V9.4l-3.2 1.8Z"
      />
    </svg>
  );
}

function formatBookingDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatBookingTimeRange(
  startTime: string,
  endTime: string,
  timeZone: string,
) {
  return `${startTime} – ${endTime} (${formatTimezoneShort(timeZone)})`;
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "ab-home__status--confirmed";
  return "ab-home__status--cancelled";
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function IntegrationRow({
  icon,
  iconClass,
  title,
  description,
  connected,
  disconnectIntent,
  onConnect,
  fetcher,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
  connected: boolean;
  disconnectIntent: string;
  onConnect: () => void;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  return (
    <div className="ab-home__integration">
      <div className={`ab-home__integration-icon ${iconClass}`}>{icon}</div>
      <div className="ab-home__integration-body">
        <div className="ab-home__integration-title">{title}</div>
        <div className="ab-home__integration-desc">{description}</div>
      </div>
      <div className="ab-home__integration-action">
        {connected ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value={disconnectIntent} />
            <s-button type="submit" tone="critical" variant="tertiary">
              Disconnect
            </s-button>
          </fetcher.Form>
        ) : (
          <s-button onClick={onConnect}>Connect</s-button>
        )}
      </div>
    </div>
  );
}

export default function AppointmentBookingHome() {
  const { stats, timezone, google, zoom } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data === "object" && data != null && "ok" in data && data.ok) {
      showAppToast(shopify, "Disconnected");
    }
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "google") {
      showAppToast(shopify, "Google Calendar connected");
      setSearchParams({}, { replace: true });
    } else if (connected === "zoom") {
      showAppToast(shopify, "Zoom connected");
      setSearchParams({}, { replace: true });
    } else if (error === "google_denied") {
      showAppToast(shopify, "Google Calendar connection was cancelled", {
        isError: true,
      });
      setSearchParams({}, { replace: true });
    } else if (error === "google_failed") {
      showAppToast(shopify, "Google Calendar connection failed. Check your Google OAuth settings.", {
        isError: true,
      });
      setSearchParams({}, { replace: true });
    } else if (error === "zoom_denied") {
      showAppToast(shopify, "Zoom connection was cancelled", { isError: true });
      setSearchParams({}, { replace: true });
    } else if (error === "zoom_failed") {
      showAppToast(shopify, "Zoom connection failed", { isError: true });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, shopify]);

  async function connect(provider: "google" | "zoom") {
    const res = await fetch(`/api/${provider}/connect`, { method: "POST" });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    if (data.url) {
      window.open(data.url, "_top");
      return;
    }
    showAppToast(
      shopify,
      data.error ||
        (provider === "zoom"
          ? "Could not start Zoom connection. Check ZOOM_CLIENT_ID in .env and your Zoom Marketplace app."
          : "Could not start Google connection."),
      { isError: true },
    );
  }

  return (
    <s-page heading="Appointment Booking">
      <div className="ab-home">
        <div className="ab-home__stats">
          <Link to="/app/bookings" className="ab-home__stat ab-home__stat--link ab-home__stat--accent">
            <div className="ab-home__stat-value">{stats.confirmedThisMonth}</div>
            <div className="ab-home__stat-label">This month bookings</div>
          </Link>
          <Link to="/app/services" className="ab-home__stat ab-home__stat--link">
            <div className="ab-home__stat-value">{stats.activeServices}</div>
            <div className="ab-home__stat-label">Active services</div>
          </Link>
          <Link to="/app/meeting-types" className="ab-home__stat ab-home__stat--link">
            <div className="ab-home__stat-value">{stats.activeMeetingTypes}</div>
            <div className="ab-home__stat-label">Active types</div>
          </Link>
        </div>

        <div className="ab-home__layout">
          <div className="ab-home__stack">
            <section className="ab-home__panel">
              <div className="ab-home__panel-head">
                <h2 className="ab-home__panel-title">Integrations</h2>
              </div>
              <div className="ab-home__panel-body">
                <div className="ab-home__integrations">
                  <IntegrationRow
                    icon={<IconGoogleCalendar />}
                    iconClass="ab-home__integration-icon--google"
                    title="Google Calendar"
                    description={
                      google
                        ? `Connected as ${google.email}`
                        : "Create calendar events automatically when bookings are confirmed."
                    }
                    connected={Boolean(google)}
                    disconnectIntent="disconnect-google"
                    onConnect={() => connect("google")}
                    fetcher={fetcher}
                  />
                  <IntegrationRow
                    icon={<IconZoom />}
                    iconClass="ab-home__integration-icon--zoom"
                    title="Zoom"
                    description={
                      zoom
                        ? `Connected as ${zoom.email}`
                        : "Create Zoom meetings automatically for video call bookings."
                    }
                    connected={Boolean(zoom)}
                    disconnectIntent="disconnect-zoom"
                    onConnect={() => connect("zoom")}
                    fetcher={fetcher}
                  />
                </div>
              </div>
            </section>

            <section className="ab-home__panel">
              <div className="ab-home__panel-head">
                <h2 className="ab-home__panel-title">Upcoming bookings</h2>
                <Link to="/app/bookings" className="ab-home__panel-link">
                  View all →
                </Link>
              </div>
              {stats.recentBookings.length === 0 ? (
                <div className="ab-home__empty">
                  No bookings yet. Add the booking widget to your storefront theme to
                  start accepting appointments.
                </div>
              ) : (
                <div className="ab-home__panel-body--flush">
                  <table className="ab-home__table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Meeting</th>
                        <th>When</th>
                        <th>Status</th>
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

          <aside className="ab-home__aside">
            <div className="ab-home__aside-card">
              <h2 className="ab-home__aside-title">Quick setup</h2>
              <ul className="ab-home__links">
                <li>
                  <Link to="/app/settings">Settings</Link>
                </li>
                <li>
                  <Link to="/app/services">Manage services</Link>
                </li>
                <li>
                  <Link to="/app/availability">Set availability</Link>
                </li>
                <li>
                  <Link to="/app/meeting-types">Meeting types</Link>
                </li>
                <li>
                  <Link to="/app/bookings">All bookings</Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
