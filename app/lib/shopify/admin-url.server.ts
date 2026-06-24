/**
 * Build a URL that opens the embedded app inside Shopify Admin.
 * Uses SHOPIFY_API_KEY (client id) as the app path segment — required for dev apps.
 */
export function embeddedAppAdminUrl(
  shop: string,
  appPath: string,
  query?: Record<string, string>,
) {
  const appId = process.env.SHOPIFY_API_KEY ?? "";
  const normalizedPath = appPath.startsWith("/") ? appPath : `/${appPath}`;
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `https://${shop}/admin/apps/${appId}${normalizedPath}${qs}`;
}

export function parseOAuthState(state: string | null) {
  if (!state) return { merchantId: undefined, shop: undefined };
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString()) as {
      merchantId?: string;
      shop?: string;
    };
    return {
      merchantId: parsed.merchantId,
      shop: parsed.shop,
    };
  } catch {
    return { merchantId: undefined, shop: undefined };
  }
}

export function redirectToIntegrations(
  shop: string | undefined,
  query: Record<string, string>,
) {
  if (shop) {
    return embeddedAppAdminUrl(shop, "/app", query);
  }
  return `/auth/login?${new URLSearchParams({
    ...query,
    notice: "Reconnect from Shopify Admin → Apps → Appointment Booking → Dashboard",
  }).toString()}`;
}
