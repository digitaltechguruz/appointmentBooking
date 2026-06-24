import prisma from "../../../db.server";
import { encrypt, decrypt } from "../../security/encryption.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "email",
].join(" ");

export function getGoogleAuthUrl(merchantId: string, shop: string) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const state = Buffer.from(JSON.stringify({ merchantId, shop })).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function handleGoogleCallback(code: string, merchantId: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error("Google token exchange failed");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.googleConnection.upsert({
    where: { merchantId },
    create: {
      merchantId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token ?? ""),
      tokenExpiresAt: expiresAt,
      email: profile.email,
      calendarId: "primary",
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token ?? ""),
      tokenExpiresAt: expiresAt,
      email: profile.email,
    },
  });
}

async function refreshGoogleToken(merchantId: string) {
  const conn = await prisma.googleConnection.findUnique({ where: { merchantId } });
  if (!conn?.refreshToken) throw new Error("No Google refresh token");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: decrypt(conn.refreshToken),
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error("Google token refresh failed");

  await prisma.googleConnection.update({
    where: { merchantId },
    data: {
      accessToken: encrypt(tokens.access_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
    },
  });
  return decrypt((await prisma.googleConnection.findUnique({ where: { merchantId } }))!.accessToken);
}

async function getValidAccessToken(merchantId: string) {
  try {
    const conn = await prisma.googleConnection.findUnique({ where: { merchantId } });
    if (!conn) return null;
    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
      return await refreshGoogleToken(merchantId);
    }
    return decrypt(conn.accessToken);
  } catch (error) {
    console.error("[google] access token unavailable", error);
    return null;
  }
}

export type CalendarEventResult = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
};

function extractMeetUrl(data: {
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
}) {
  if (data.hangoutLink) return data.hangoutLink;
  const video = data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video" && ep.uri,
  );
  return video?.uri ?? null;
}

export async function createCalendarEvent(
  merchantId: string,
  event: {
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    attendeeEmail: string;
    merchantEmail?: string | null;
    googleAccountEmail?: string | null;
    timeZone?: string;
    meetingLink?: string;
    addGoogleMeet?: boolean;
  },
): Promise<CalendarEventResult | null> {
  try {
    const accessToken = await getValidAccessToken(merchantId);
    if (!accessToken) return null;

    const conn = await prisma.googleConnection.findUnique({ where: { merchantId } });
    const calendarId = conn?.calendarId ?? "primary";
    const timeZone = event.timeZone ?? "UTC";

    const start = `${event.date}T${event.startTime}:00`;
    const end = `${event.date}T${event.endTime}:00`;

    const requestId = crypto.randomUUID();
    const attendees: Array<{ email: string; optional?: boolean }> = [
      { email: event.attendeeEmail },
    ];
    const extraEmails = new Set<string>();
    for (const email of [event.googleAccountEmail, event.merchantEmail]) {
      const trimmed = email?.trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === event.attendeeEmail.toLowerCase()) continue;
      extraEmails.add(trimmed);
    }
    for (const email of extraEmails) {
      attendees.push({ email, optional: true });
    }

    const body: Record<string, unknown> = {
      summary: event.title,
      description: event.description,
      location: event.meetingLink,
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
      attendees,
    };

    if (event.addGoogleMeet) {
      body.conferenceData = {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const query = new URLSearchParams({ sendUpdates: "all" });
    if (event.addGoogleMeet) {
      query.set("conferenceDataVersion", "1");
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      console.error("[google] event create failed", await res.text());
      return null;
    }
    const data = await res.json();
    return {
      eventId: data.id as string,
      meetUrl: extractMeetUrl(data),
      htmlLink: (data.htmlLink as string | undefined) ?? null,
    };
  } catch (error) {
    console.error("[google] event create error", error);
    return null;
  }
}

export async function deleteCalendarEvent(
  merchantId: string,
  eventId: string,
) {
  const accessToken = await getValidAccessToken(merchantId);
  if (!accessToken) return false;

  const conn = await prisma.googleConnection.findUnique({ where: { merchantId } });
  const calendarId = conn?.calendarId ?? "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error("[google] event delete failed", await res.text());
    return false;
  }
  return true;
}

export async function disconnectGoogle(merchantId: string) {
  await prisma.googleConnection.delete({ where: { merchantId } }).catch(() => {});
}

export async function getGoogleConnection(merchantId: string) {
  return prisma.googleConnection.findUnique({ where: { merchantId } });
}
