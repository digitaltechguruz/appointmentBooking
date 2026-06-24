function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/** Public app base URL (tunnel in dev, production domain in prod). */
export function getAppBaseUrl() {
  const raw =
    process.env.SHOPIFY_APP_URL ||
    process.env.HOST ||
    process.env.ZOOM_REDIRECT_URI?.replace(/\/auth\/zoom\/callback$/, "") ||
    "";
  if (!raw) return "";
  try {
    return normalizeBaseUrl(new URL(raw).origin);
  } catch {
    return normalizeBaseUrl(raw);
  }
}

export function getZoomRedirectUri() {
  const explicit = process.env.ZOOM_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return base ? `${base}/auth/zoom/callback` : "";
}

export function getGoogleRedirectUri() {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return base ? `${base}/auth/google/callback` : "";
}

export type ZoomConfigIssue =
  | "missing_client_id"
  | "missing_client_secret"
  | "missing_redirect_uri";

export function getZoomConfigIssues(): ZoomConfigIssue[] {
  const issues: ZoomConfigIssue[] = [];
  if (!process.env.ZOOM_CLIENT_ID?.trim()) {
    issues.push("missing_client_id");
  }
  if (!process.env.ZOOM_CLIENT_SECRET?.trim()) {
    issues.push("missing_client_secret");
  }
  if (!getZoomRedirectUri()) {
    issues.push("missing_redirect_uri");
  }
  return issues;
}

export function zoomConfigErrorMessage(issues: ZoomConfigIssue[]) {
  if (issues.includes("missing_client_id") || issues.includes("missing_client_secret")) {
    return "Zoom is not configured. Add ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET to .env from your Zoom Marketplace app.";
  }
  if (issues.includes("missing_redirect_uri")) {
    return "Zoom redirect URL is missing. Set SHOPIFY_APP_URL or ZOOM_REDIRECT_URI in .env.";
  }
  return "Zoom is not configured.";
}
