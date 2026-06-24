import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { handleGoogleCallback } from "../lib/integrations/google/calendar.server";
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
      redirectToIntegrations(shop, {
        error: error === "access_denied" ? "google_denied" : "google_denied",
      }),
    );
  }

  try {
    await handleGoogleCallback(code, merchantId);
    return redirect(
      redirectToIntegrations(shop, { connected: "google" }),
    );
  } catch {
    return redirect(redirectToIntegrations(shop, { error: "google_failed" }));
  }
};
