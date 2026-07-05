import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useFetcher,
  useSearchParams,
  useRevalidator,
  Link,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useState, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdminMerchant } from "../lib/auth.server";
import {
  BookingError,
  listBookings,
  cancelBooking,
  deleteBooking,
  rescheduleBooking,
  getAvailableSlots,
  getBookingStatusCounts,
} from "../models/booking.server";
import { listServices } from "../models/service.server";
import type { BookingWithRelations } from "../types/admin";
import {
  parseJsonBody,
  bookingSlotsQuerySchema,
  bookingRescheduleSchema,
} from "../lib/validation/schemas";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import { useAdminI18n } from "../lib/admin-i18n";
import { formatTimezoneShort } from "../lib/booking/timezone";
import "../components/admin/bookings.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as
    | "CONFIRMED"
    | "CANCELLED"
    | null;
  const serviceId = url.searchParams.get("serviceId") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;

  const [result, services, stats] = await Promise.all([
    listBookings(merchant.id, {
      status: status ?? undefined,
      serviceId,
      date,
    }),
    listServices(merchant.id),
    getBookingStatusCounts(merchant.id),
  ]);

  return {
    ...result,
    services,
    stats,
    timezone: merchant.timezone ?? "UTC",
    filters: { status, serviceId, date },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "slots") {
    const parsed = parseJsonBody(bookingSlotsQuerySchema, {
      serviceId: formData.get("serviceId"),
      date: formData.get("date"),
    });
    if (!parsed.success) {
      return { error: "Invalid date or service" };
    }
    const slots = await getAvailableSlots(
      merchant.id,
      parsed.data.serviceId,
      parsed.data.date,
    );
    return {
      ok: true as const,
      action: "slots" as const,
      date: parsed.data.date,
      slots,
    };
  }

  const bookingId = formData.get("bookingId") as string;

  if (!bookingId && intent !== "slots") {
    return { error: "Missing booking" };
  }

  try {
    if (intent === "cancel") {
      await cancelBooking(merchant.id, bookingId);
      return { ok: true as const, action: "cancelled" as const, bookingId };
    }
    if (intent === "delete") {
      await deleteBooking(merchant.id, bookingId);
      return { ok: true as const, action: "deleted" as const, bookingId };
    }
    if (intent === "reschedule") {
      const parsed = parseJsonBody(bookingRescheduleSchema, {
        bookingId,
        date: formData.get("date"),
        startTime: formData.get("startTime"),
      });
      if (!parsed.success) {
        return { error: "Please choose a valid date and time" };
      }
      await rescheduleBooking(merchant.id, parsed.data.bookingId, {
        date: parsed.data.date,
        startTime: parsed.data.startTime,
      });
      return { ok: true as const, action: "rescheduled" as const, bookingId };
    }
    return { error: "Unknown action" };
  } catch (error) {
    if (error instanceof BookingError) {
      return { error: error.message };
    }
    throw error;
  }
};

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

function formatCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "ab-bookings__status--confirmed";
  return "ab-bookings__status--cancelled";
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function IconView() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 6h12M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6m2 0v9.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 15.5V6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M8 9v5M12 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCancel() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconReschedule() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11v3M8.5 12.5H10a1.5 1.5 0 0 0 0-3H9a1.5 1.5 0 0 1 0-3h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function bookingDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function MeetingLinks({ booking }: { booking: BookingWithRelations }) {
  const hasZoom = Boolean(booking.zoomJoinUrl || booking.zoomStartUrl);
  const hasMeet = Boolean(booking.googleMeetUrl);
  const hasCalendar = Boolean(booking.googleCalendarEventId);

  if (!hasZoom && !hasMeet && !hasCalendar) {
    return <span className="ab-bookings__no-link">No meeting links</span>;
  }

  return (
    <div className="ab-bookings__links">
      {booking.zoomJoinUrl && (
        <a
          className="ab-bookings__link-chip ab-bookings__link-chip--zoom"
          href={booking.zoomJoinUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join link (Zoom)
        </a>
      )}
      {booking.zoomStartUrl && (
        <a
          className="ab-bookings__link-chip ab-bookings__link-chip--host"
          href={booking.zoomStartUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Host link (Zoom)
        </a>
      )}
      {booking.googleMeetUrl && (
        <a
          className="ab-bookings__link-chip ab-bookings__link-chip--meet"
          href={booking.googleMeetUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Meet
        </a>
      )}
      {hasCalendar && (
        <span className="ab-bookings__calendar-badge">
          ✓ Synced to Google Calendar
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="ab-bookings__detail-row">
      <span className="ab-bookings__detail-label">{label}</span>
      <span className="ab-bookings__detail-value">{value}</span>
    </div>
  );
}

function BookingDetailDrawer({
  booking,
  timezone,
  onClose,
  onReschedule,
  fetcher,
  isSubmitting,
}: {
  booking: BookingWithRelations;
  timezone: string;
  onClose: () => void;
  onReschedule: () => void;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  isSubmitting: boolean;
}) {
  const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`;

  return (
    <div
      className="ab-bookings__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ab-bookings__drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
      >
        <div className="ab-bookings__drawer-header">
          <h2 className="ab-bookings__drawer-title" id="booking-detail-title">
            Booking details
          </h2>
          <button
            type="button"
            className="ab-bookings__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="ab-bookings__drawer-body">
          <div className="ab-bookings__detail-section">
            <h3 className="ab-bookings__detail-heading">Customer</h3>
            <div className="ab-bookings__detail-grid">
              <DetailRow label="Name" value={customerName} />
              <DetailRow
                label="Email"
                value={
                  <a href={`mailto:${booking.customer.email}`}>
                    {booking.customer.email}
                  </a>
                }
              />
              <DetailRow label="Phone" value={booking.customer.phone} />
              <DetailRow label="Note" value={booking.note} />
            </div>
          </div>

          <div className="ab-bookings__detail-section">
            <h3 className="ab-bookings__detail-heading">Appointment</h3>
            <div className="ab-bookings__detail-grid">
              <DetailRow label="Service" value={booking.service.name} />
              <DetailRow label="Meeting" value={booking.meetingType.name} />
              <DetailRow
                label="Type"
                value={booking.meetingType.subtitle ?? booking.meetingType.type}
              />
              <DetailRow label="Date" value={formatBookingDate(booking.bookingDate)} />
              <DetailRow
                label="Time"
                value={formatBookingTimeRange(
                  booking.startTime,
                  booking.endTime,
                  timezone,
                )}
              />
              <DetailRow
                label="Status"
                value={
                  <span className={`ab-bookings__status ${statusClass(booking.status)}`}>
                    {formatStatus(booking.status)}
                  </span>
                }
              />
              <DetailRow label="Booked on" value={formatCreatedAt(booking.createdAt)} />
            </div>
          </div>

          <div className="ab-bookings__detail-section">
            <h3 className="ab-bookings__detail-heading">Meeting links</h3>
            <MeetingLinks booking={booking} />
          </div>
        </div>

        <div className="ab-bookings__drawer-footer">
          <button
            type="button"
            className="ab-bookings__drawer-btn ab-bookings__drawer-btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          {booking.status === "CANCELLED" && (
            <button
              type="button"
              className="ab-bookings__drawer-btn ab-bookings__drawer-btn--primary"
              onClick={onReschedule}
            >
              Reschedule booking
            </button>
          )}
          {booking.status !== "CANCELLED" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <input type="hidden" name="bookingId" value={booking.id} />
              <button
                type="submit"
                className="ab-bookings__drawer-btn ab-bookings__drawer-btn--cancel"
                disabled={isSubmitting}
                onClick={(e) => {
                  if (
                    !confirm(
                      "Cancel this booking? The Google Calendar event, Google Meet, and Zoom meeting will be removed.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Cancel booking
              </button>
            </fetcher.Form>
          )}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="bookingId" value={booking.id} />
            <button
              type="submit"
              className="ab-bookings__drawer-btn ab-bookings__drawer-btn--delete"
              disabled={isSubmitting}
              onClick={(e) => {
                if (
                  !confirm(
                    "Permanently delete this booking? This cannot be undone.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </fetcher.Form>
        </div>
      </div>
    </div>
  );
}

function RescheduleDrawer({
  booking,
  onClose,
  fetcher,
  slotsFetcher,
  isSubmitting,
}: {
  booking: BookingWithRelations;
  onClose: () => void;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  slotsFetcher: ReturnType<typeof useFetcher<typeof action>>;
  isSubmitting: boolean;
}) {
  const [date, setDate] = useState(bookingDateInputValue(booking.bookingDate));
  const [startTime, setStartTime] = useState(booking.startTime);
  const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`;

  useEffect(() => {
    const fd = new FormData();
    fd.set("intent", "slots");
    fd.set("serviceId", booking.serviceId);
    fd.set("date", date);
    slotsFetcher.submit(fd, { method: "post" });
  }, [booking.serviceId, date]);

  const slots =
    slotsFetcher.data &&
    "ok" in slotsFetcher.data &&
    slotsFetcher.data.ok &&
    slotsFetcher.data.action === "slots" &&
    slotsFetcher.data.date === date
      ? slotsFetcher.data.slots
      : [];

  const slotsLoading = slotsFetcher.state !== "idle";

  useEffect(() => {
    if (slots.length === 0) return;
    if (!slots.some((slot) => slot.startTime === startTime)) {
      setStartTime(slots[0]!.startTime);
    }
  }, [slots, startTime]);

  return (
    <div
      className="ab-bookings__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ab-bookings__drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
      >
        <div className="ab-bookings__drawer-header">
          <h2 className="ab-bookings__drawer-title" id="reschedule-title">
            Reschedule booking
          </h2>
          <button
            type="button"
            className="ab-bookings__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <fetcher.Form method="post" className="ab-bookings__drawer-form">
          <input type="hidden" name="intent" value="reschedule" />
          <input type="hidden" name="bookingId" value={booking.id} />

          <div className="ab-bookings__drawer-body">
            <p className="ab-bookings__reschedule-intro">
              Restore this cancelled booking by choosing a new date and time.
              Meeting links will be recreated automatically.
            </p>

            <div className="ab-bookings__reschedule-summary">
              <div className="ab-bookings__reschedule-line">
                <span>Customer</span>
                <strong>{customerName}</strong>
              </div>
              <div className="ab-bookings__reschedule-line">
                <span>Service</span>
                <strong>{booking.service.name}</strong>
              </div>
            </div>

            <div className="ab-bookings__reschedule-fields">
              <div className="ab-bookings__field">
                <label className="ab-bookings__label" htmlFor="reschedule-date">
                  Date
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  name="date"
                  className="ab-bookings__input"
                  value={date}
                  required
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="ab-bookings__field">
                <label className="ab-bookings__label" htmlFor="reschedule-time">
                  Time
                </label>
                <select
                  id="reschedule-time"
                  name="startTime"
                  className="ab-bookings__select"
                  value={startTime}
                  required
                  disabled={slotsLoading || slots.length === 0}
                  onChange={(e) => setStartTime(e.target.value)}
                >
                  {slotsLoading && <option value="">Loading times…</option>}
                  {!slotsLoading && slots.length === 0 && (
                    <option value="">No times available</option>
                  )}
                  {!slotsLoading &&
                    slots.map((slot) => (
                      <option key={slot.startTime} value={slot.startTime}>
                        {slot.startTime} – {slot.endTime}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <div className="ab-bookings__drawer-footer">
            <button
              type="button"
              className="ab-bookings__drawer-btn ab-bookings__drawer-btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ab-bookings__drawer-btn ab-bookings__drawer-btn--primary"
              disabled={isSubmitting || slotsLoading || slots.length === 0}
            >
              {isSubmitting ? "Saving…" : "Confirm reschedule"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const { bookings, total, services, stats, filters, timezone } =
    useLoaderData<typeof loader>();
  const { t } = useAdminI18n();
  const fetcher = useFetcher<typeof action>();
  const slotsFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const isSubmitting = fetcher.state !== "idle";
  const [viewBookingId, setViewBookingId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(
    null,
  );

  const typedBookings = bookings as BookingWithRelations[];
  const hasFilters = Boolean(filters.status || filters.serviceId || filters.date);
  const viewBooking =
    viewBookingId != null
      ? typedBookings.find((b) => b.id === viewBookingId) ?? null
      : null;
  const rescheduleBooking =
    rescheduleBookingId != null
      ? typedBookings.find((b) => b.id === rescheduleBookingId) ?? null
      : null;

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data !== "object" || data == null) return;

    if ("ok" in data && data.ok) {
      const result = data as {
        ok: true;
        action?: string;
        bookingId?: string;
      };
      if (result.action === "cancelled") {
        showAppToast(
          shopify,
          "Booking cancelled — calendar event and meeting links removed",
        );
      } else if (result.action === "rescheduled") {
        showAppToast(
          shopify,
          "Booking rescheduled — status restored and meeting links recreated",
        );
        setRescheduleBookingId(null);
        setViewBookingId(null);
      } else if (result.action === "deleted") {
        showAppToast(shopify, "Booking deleted");
        if (result.bookingId) {
          setViewBookingId((current) =>
            current === result.bookingId ? null : current,
          );
          setRescheduleBookingId((current) =>
            current === result.bookingId ? null : current,
          );
        }
      }
      revalidator.revalidate();
      return;
    }

    if ("error" in data && data.error) {
      showAppToast(
        shopify,
        typeof data.error === "string" ? data.error : "Something went wrong",
        { isError: true },
      );
    }
  });

  useEffect(() => {
    if (!viewBookingId && !rescheduleBookingId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setViewBookingId(null);
        setRescheduleBookingId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewBookingId, rescheduleBookingId]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  return (
    <s-page heading={t("bookings.pageTitle")}>
      <div className="ab-bookings">
        <div className="ab-bookings__stats">
          <div className="ab-bookings__stat">
            <div className="ab-bookings__stat-value">{stats.total}</div>
            <div className="ab-bookings__stat-label">Total bookings</div>
          </div>
          <div className="ab-bookings__stat ab-bookings__stat--confirmed">
            <div className="ab-bookings__stat-value">{stats.CONFIRMED}</div>
            <div className="ab-bookings__stat-label">Confirmed</div>
          </div>
          <div className="ab-bookings__stat ab-bookings__stat--cancelled">
            <div className="ab-bookings__stat-value">{stats.CANCELLED}</div>
            <div className="ab-bookings__stat-label">Cancelled</div>
          </div>
        </div>

        <div className="ab-bookings__panel">
          <div className="ab-bookings__toolbar">
            <p className="ab-bookings__toolbar-title">All bookings</p>
            <div className="ab-bookings__filters">
              <div className="ab-bookings__field">
                <label className="ab-bookings__label" htmlFor="filter-status">
                  Status
                </label>
                <select
                  id="filter-status"
                  className="ab-bookings__select"
                  value={filters.status ?? ""}
                  onChange={(e) => updateFilter("status", e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="ab-bookings__field">
                <label className="ab-bookings__label" htmlFor="filter-service">
                  Service
                </label>
                <select
                  id="filter-service"
                  className="ab-bookings__select"
                  value={filters.serviceId ?? ""}
                  onChange={(e) => updateFilter("serviceId", e.target.value)}
                >
                  <option value="">All services</option>
                  {services.map((s: { id: string; name: string }) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ab-bookings__field">
                <label className="ab-bookings__label" htmlFor="filter-date">
                  Date
                </label>
                <input
                  id="filter-date"
                  type="date"
                  className="ab-bookings__input"
                  value={filters.date ?? ""}
                  onChange={(e) => updateFilter("date", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="ab-bookings__summary">
            Showing {typedBookings.length} of {total} booking
            {total === 1 ? "" : "s"}
          </div>

          {typedBookings.length === 0 ? (
            <div className="ab-bookings__empty">
              <div className="ab-bookings__empty-icon" aria-hidden>
                📅
              </div>
              <h3 className="ab-bookings__empty-title">
                {hasFilters ? "No bookings match your filters" : "No bookings yet"}
              </h3>
              <p className="ab-bookings__empty-text">
                {hasFilters
                  ? "Try changing the status, service, or date filters to see more results."
                  : "Bookings from your storefront will appear here. Click View on any row for full details."}
              </p>
              {!hasFilters && (
                <Link to="/app" className="ab-bookings__empty-link">
                  Connect Zoom & Google Calendar on Dashboard →
                </Link>
              )}
            </div>
          ) : (
            <table className="ab-bookings-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Meeting</th>
                  <th>When</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {typedBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="ab-bookings__customer-name">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </div>
                    </td>
                    <td>{booking.service.name}</td>
                    <td>
                      <div className="ab-bookings__meeting">
                        {booking.meetingType.name}
                      </div>
                      {booking.meetingType.subtitle && (
                        <div className="ab-bookings__meeting-sub">
                          {booking.meetingType.subtitle}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="ab-bookings__when">
                        {formatBookingDate(booking.bookingDate)}
                      </div>
                      <div className="ab-bookings__when-time">
                        {formatBookingTimeRange(
                          booking.startTime,
                          booking.endTime,
                          timezone,
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`ab-bookings__status ${statusClass(booking.status)}`}
                      >
                        {formatStatus(booking.status)}
                      </span>
                    </td>
                    <td>
                      <div className="ab-bookings__actions">
                        <button
                          type="button"
                          className="ab-bookings__icon-btn ab-bookings__icon-btn--view"
                          aria-label="View booking details"
                          title="View details"
                          onClick={() => setViewBookingId(booking.id)}
                        >
                          <IconView />
                        </button>
                        {booking.status === "CANCELLED" && (
                          <button
                            type="button"
                            className="ab-bookings__icon-btn ab-bookings__icon-btn--reschedule"
                            aria-label="Reschedule booking"
                            title="Reschedule booking"
                            onClick={() => {
                              setViewBookingId(null);
                              setRescheduleBookingId(booking.id);
                            }}
                          >
                            <IconReschedule />
                          </button>
                        )}
                        {booking.status !== "CANCELLED" && (
                          <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="cancel" />
                            <input
                              type="hidden"
                              name="bookingId"
                              value={booking.id}
                            />
                            <button
                              type="submit"
                              className="ab-bookings__icon-btn ab-bookings__icon-btn--cancel"
                              aria-label="Cancel booking"
                              title="Cancel booking"
                              disabled={isSubmitting}
                              onClick={(e) => {
                                if (
                                  !confirm(
                                    "Cancel this booking? The Google Calendar event, Google Meet, and Zoom meeting will be removed.",
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <IconCancel />
                            </button>
                          </fetcher.Form>
                        )}
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input
                            type="hidden"
                            name="bookingId"
                            value={booking.id}
                          />
                          <button
                            type="submit"
                            className="ab-bookings__icon-btn ab-bookings__icon-btn--delete"
                            aria-label="Delete booking"
                            title="Delete booking"
                            disabled={isSubmitting}
                            onClick={(e) => {
                              if (
                                !confirm(
                                  "Permanently delete this booking? This cannot be undone.",
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <IconTrash />
                          </button>
                        </fetcher.Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewBooking && (
        <BookingDetailDrawer
          booking={viewBooking}
          timezone={timezone}
          onClose={() => setViewBookingId(null)}
          onReschedule={() => {
            setRescheduleBookingId(viewBooking.id);
            setViewBookingId(null);
          }}
          fetcher={fetcher}
          isSubmitting={isSubmitting}
        />
      )}

      {rescheduleBooking && (
        <RescheduleDrawer
          booking={rescheduleBooking}
          onClose={() => setRescheduleBookingId(null)}
          fetcher={fetcher}
          slotsFetcher={slotsFetcher}
          isSubmitting={isSubmitting}
        />
      )}
    </s-page>
  );
}

export const headers = boundary.headers;
