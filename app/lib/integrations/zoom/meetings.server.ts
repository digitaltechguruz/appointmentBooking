import prisma from "../../../db.server";
import { encrypt, decrypt } from "../../security/encryption.server";
import {
  getZoomConfigIssues,
  getZoomRedirectUri,
  zoomConfigErrorMessage,
} from "../oauth-config.server";

const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

/**
 * Scopes are configured in Zoom Marketplace (General app → Scopes), not in the
 * authorize URL. Add at least: user:read:user, meeting:write:meeting,
 * meeting:delete:meeting
 */
export const ZOOM_PORTAL_SCOPES = [
  "user:read:user",
  "meeting:write:meeting",
  "meeting:delete:meeting",
] as const;

export function assertZoomConfigured() {
  const issues = getZoomConfigIssues();
  if (issues.length) {
    throw new Error(zoomConfigErrorMessage(issues));
  }
}

export function getZoomAuthUrl(merchantId: string, shop: string) {
  assertZoomConfigured();

  const redirectUri = getZoomRedirectUri();
  const state = Buffer.from(JSON.stringify({ merchantId, shop })).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    state,
  });
  return `${ZOOM_AUTH_URL}?${params}`;
}

export async function handleZoomCallback(code: string, merchantId: string) {
  assertZoomConfigured();
  const redirectUri = getZoomRedirectUri();

  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    },
  );
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error("Zoom token exchange failed");

  const profileRes = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  await prisma.zoomConnection.upsert({
    where: { merchantId },
    create: {
      merchantId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token ?? ""),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      accountId: profile.id,
      email: profile.email,
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token ?? ""),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      email: profile.email,
    },
  });
}

async function getValidZoomToken(merchantId: string) {
  const conn = await prisma.zoomConnection.findUnique({ where: { merchantId } });
  if (!conn) return null;

  if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.refreshToken) {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
    ).toString("base64");
    const res = await fetch(
      `${ZOOM_TOKEN_URL}?grant_type=refresh_token&refresh_token=${encodeURIComponent(decrypt(conn.refreshToken))}`,
      { method: "POST", headers: { Authorization: `Basic ${credentials}` } },
    );
    const tokens = await res.json();
    if (tokens.access_token) {
      await prisma.zoomConnection.update({
        where: { merchantId },
        data: {
          accessToken: encrypt(tokens.access_token),
          tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        },
      });
      return tokens.access_token as string;
    }
  }
  return decrypt(conn.accessToken);
}

export async function createZoomMeeting(
  merchantId: string,
  meeting: {
    topic: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    timeZone?: string;
  },
) {
  const token = await getValidZoomToken(merchantId);
  if (!token) return null;

  const timeZone = meeting.timeZone ?? "UTC";
  const start = `${meeting.date}T${meeting.startTime}:00`;
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: meeting.topic,
      type: 2,
      start_time: start,
      duration: meeting.durationMinutes,
      timezone: timeZone,
    }),
  });

  if (!res.ok) {
    console.error("[zoom] meeting create failed", await res.text());
    return null;
  }
  const data = await res.json();
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url as string,
    startUrl: data.start_url as string,
  };
}

export async function deleteZoomMeeting(merchantId: string, meetingId: string) {
  const token = await getValidZoomToken(merchantId);
  if (!token) return false;

  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    console.error("[zoom] meeting delete failed", await res.text());
    return false;
  }
  return true;
}

export async function disconnectZoom(merchantId: string) {
  await prisma.zoomConnection.delete({ where: { merchantId } }).catch(() => {});
}

export async function getZoomConnection(merchantId: string) {
  return prisma.zoomConnection.findUnique({ where: { merchantId } });
}
