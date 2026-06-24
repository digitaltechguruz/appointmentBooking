import { Resend } from "resend";
import type { Booking, Customer, MeetingType, Service } from "@prisma/client";
import { MEETING_TYPE_LABELS } from "../constants";

type BookingWithRelations = Booking & {
  service: Service;
  meetingType: MeetingType;
  customer: Customer;
};

export type BookingEmailKind =
  | "confirmed"
  | "cancelled"
  | "deleted"
  | "rescheduled";

export type EmailContext = {
  merchantEmail?: string | null;
  shopName?: string | null;
  shopEmail?: string | null;
  googleCalendarConnected?: boolean;
  merchantTimezone?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function extractEmailAddress(value: string): string | null {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return null;
}

function escapeDisplayName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formatEmailFrom(displayName: string, email: string): string {
  return `"${escapeDisplayName(displayName)}" <${email}>`;
}

export function resolveEmailFrom(context: EmailContext): string | null {
  if (!isEmailConfigured()) return null;

  const email =
    extractEmailAddress(context.shopEmail ?? "") ??
    extractEmailAddress(process.env.RESEND_FROM_EMAIL ?? "") ??
    extractEmailAddress(process.env.EMAIL_FROM ?? "");

  if (!email) return null;

  const displayName = context.shopName?.trim() || "Store";
  return formatEmailFrom(displayName, email);
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function formatDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

function formatTimeRange(
  startTime: string,
  endTime: string,
  timeZone: string,
): string {
  return `${startTime} – ${endTime} (${timeZone})`;
}

function meetingLabel(booking: BookingWithRelations): string {
  return (
    MEETING_TYPE_LABELS[booking.meetingType.type] ?? booking.meetingType.name
  );
}

function bookingDetailsList(
  booking: BookingWithRelations,
  timeZone: string,
  includeCustomer = false,
): string {
  const items = [
    ...(includeCustomer
      ? [
          `<li><strong>Customer:</strong> ${booking.customer.firstName} ${booking.customer.lastName}</li>`,
          `<li><strong>Email:</strong> ${booking.customer.email}</li>`,
        ]
      : []),
    `<li><strong>Service:</strong> ${booking.service.name}</li>`,
    `<li><strong>Meeting type:</strong> ${meetingLabel(booking)}</li>`,
    `<li><strong>Date:</strong> ${formatDate(booking.bookingDate, timeZone)}</li>`,
    `<li><strong>Time:</strong> ${formatTimeRange(booking.startTime, booking.endTime, timeZone)}</li>`,
  ];
  return `<ul>${items.join("")}</ul>`;
}

function meetingLinksSection(booking: BookingWithRelations): string {
  const parts: string[] = [];
  if (booking.zoomJoinUrl) {
    parts.push(
      `<p><strong>Zoom link:</strong> <a href="${booking.zoomJoinUrl}">${booking.zoomJoinUrl}</a></p>`,
    );
  }
  if (booking.googleMeetUrl) {
    parts.push(
      `<p><strong>Google Meet:</strong> <a href="${booking.googleMeetUrl}">${booking.googleMeetUrl}</a></p>`,
    );
  }
  return parts.join("");
}

type EmailTemplate = {
  customerSubject: string;
  customerHtml: string;
  adminSubject: string;
  adminHtml: string;
};

function buildEmailTemplate(
  booking: BookingWithRelations,
  kind: BookingEmailKind,
  timeZone: string,
): EmailTemplate {
  const serviceName = booking.service.name;
  const customerName = booking.customer.firstName;
  const fullName = `${booking.customer.firstName} ${booking.customer.lastName}`;
  const details = bookingDetailsList(booking, timeZone);
  const adminDetails = bookingDetailsList(booking, timeZone, true);
  const links = meetingLinksSection(booking);

  switch (kind) {
    case "confirmed":
      return {
        customerSubject: `Booking confirmed: ${serviceName}`,
        customerHtml: `
          <h2>Booking Confirmed</h2>
          <p>Hi ${customerName},</p>
          <p>Your appointment has been confirmed.</p>
          ${details}
          ${links}
          <p>Thank you!</p>
        `,
        adminSubject: `New booking: ${serviceName} — ${fullName}`,
        adminHtml: `
          <h2>New booking</h2>
          <p>A new appointment was booked on your storefront.</p>
          ${adminDetails}
          ${links}
        `,
      };
    case "rescheduled":
      return {
        customerSubject: `Booking rescheduled: ${serviceName}`,
        customerHtml: `
          <h2>Booking Rescheduled</h2>
          <p>Hi ${customerName},</p>
          <p>Your appointment has been rescheduled to the new time below.</p>
          ${details}
          ${links}
          <p>Thank you!</p>
        `,
        adminSubject: `Booking rescheduled: ${serviceName} — ${fullName}`,
        adminHtml: `
          <h2>Booking rescheduled</h2>
          <p>An appointment was rescheduled on your storefront.</p>
          ${adminDetails}
          ${links}
        `,
      };
    case "cancelled":
      return {
        customerSubject: `Booking cancelled: ${serviceName}`,
        customerHtml: `
          <h2>Booking Cancelled</h2>
          <p>Hi ${customerName},</p>
          <p>Your appointment has been cancelled.</p>
          ${details}
          <p>If you did not request this, please contact the store.</p>
        `,
        adminSubject: `Booking cancelled: ${serviceName} — ${fullName}`,
        adminHtml: `
          <h2>Booking cancelled</h2>
          <p>An appointment was cancelled.</p>
          ${adminDetails}
        `,
      };
    case "deleted":
      return {
        customerSubject: `Booking removed: ${serviceName}`,
        customerHtml: `
          <h2>Booking Removed</h2>
          <p>Hi ${customerName},</p>
          <p>Your appointment has been removed from our system.</p>
          ${details}
          <p>If you have questions, please contact the store.</p>
        `,
        adminSubject: `Booking deleted: ${serviceName} — ${fullName}`,
        adminHtml: `
          <h2>Booking deleted</h2>
          <p>An appointment was permanently deleted.</p>
          ${adminDetails}
        `,
      };
  }
}

async function sendViaResend(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  const { error } = await resend.emails.send({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function sendToRecipient(
  from: string,
  to: string,
  subject: string,
  html: string,
  label: string,
) {
  try {
    await sendViaResend({ from, to, subject, html });
  } catch (error) {
    console.error(`[email] ${label} failed`, { to, error });
  }
}

export async function sendBookingNotificationEmails(
  booking: BookingWithRelations,
  kind: BookingEmailKind,
  context: EmailContext = {},
) {
  const from = resolveEmailFrom(context);
  const timeZone = context.merchantTimezone ?? "UTC";
  const template = buildEmailTemplate(booking, kind, timeZone);
  const customerEmail = booking.customer.email.trim();
  const adminEmail = context.merchantEmail?.trim() ?? null;

  if (!from) {
    console.log(
      `[email:dev] Resend not configured or sender unavailable — ${kind} notification not sent`,
      {
        customer: customerEmail,
        admin: adminEmail,
        kind,
        hint:
          context.googleCalendarConnected && kind === "confirmed"
            ? "Google Calendar may still email a calendar invite"
            : "Set RESEND_API_KEY and verify sender domain (or RESEND_FROM_EMAIL fallback)",
      },
    );
    return { sent: false, mode: "dev-log" as const };
  }

  await sendToRecipient(
    from,
    customerEmail,
    template.customerSubject,
    template.customerHtml,
    `${kind} customer notification`,
  );

  if (adminEmail && adminEmail.toLowerCase() !== customerEmail.toLowerCase()) {
    await sendToRecipient(
      from,
      adminEmail,
      template.adminSubject,
      template.adminHtml,
      `${kind} admin notification`,
    );
  }

  return { sent: true, mode: "resend" as const };
}

/** @deprecated Use sendBookingNotificationEmails with kind "confirmed" */
export async function sendBookingConfirmationEmail(
  booking: BookingWithRelations,
  context: EmailContext = {},
) {
  return sendBookingNotificationEmails(booking, "confirmed", context);
}
