import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { handleZoomCallback } from "../lib/integrations/zoom/meetings.server";
import {
  parseOAuthState,
  redirectToIntegrations,
} from "../lib/shopify/admin-url.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const { merchantId, shop } = parseOAuthState(state);

  if (error || !code || !state || !merchantId || !shop) {
    return redirect(
      redirectToIntegrations(shop, { error: "zoom_denied" }),
    );
  }

  try {
    await handleZoomCallback(code, merchantId);
    return redirect(
      redirectToIntegrations(shop, { connected: "zoom" }),
    );
  } catch {
    return redirect(redirectToIntegrations(shop, { error: "zoom_failed" }));
  }
};
