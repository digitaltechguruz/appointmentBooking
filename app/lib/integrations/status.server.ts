import type { MeetingTypeKind } from "@prisma/client";
import { meetingTypeHasVideoLink } from "../constants";
import { getGoogleConnection } from "./google/calendar.server";
import { getZoomConnection } from "./zoom/meetings.server";

export type IntegrationStatus = {
  google: boolean;
  zoom: boolean;
  googleEmail: string | null;
  zoomEmail: string | null;
};

export type IntegrationConnections = Pick<
  IntegrationStatus,
  "google" | "zoom"
>;

export async function getIntegrationStatus(
  merchantId: string,
): Promise<IntegrationStatus> {
  const [google, zoom] = await Promise.all([
    getGoogleConnection(merchantId),
    getZoomConnection(merchantId),
  ]);
  return {
    google: Boolean(google),
    zoom: Boolean(zoom),
    googleEmail: google?.email ?? null,
    zoomEmail: zoom?.email ?? null,
  };
}

export async function getIntegrationConnections(
  merchantId: string,
): Promise<IntegrationConnections> {
  const status = await getIntegrationStatus(merchantId);
  return { google: status.google, zoom: status.zoom };
}

export function isMeetingTypeIntegrationAvailable(
  meetingType: {
    videoLinkEnabled?: boolean;
    type: MeetingTypeKind;
  },
  connections: IntegrationConnections,
) {
  if (!meetingTypeHasVideoLink(meetingType)) return true;
  return connections.google || connections.zoom;
}
