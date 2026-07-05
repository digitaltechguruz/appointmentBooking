import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  ADMIN_LOCALE_HEADER,
  normalizeAdminLocale,
} from "../../lib/admin-i18n.shared.js";

function readUrlLocale(search: string) {
  const fromUrl = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("locale");
  return fromUrl ? normalizeAdminLocale(fromUrl) : null;
}

function readBridgeLocale(shopify: ReturnType<typeof useAppBridge> | null) {
  const raw = shopify?.config?.locale;
  return raw ? normalizeAdminLocale(String(raw)) : null;
}

/** Keep ?locale= in sync with Shopify Admin / App Bridge and reload messages. */
export function AdminLocaleSync({ serverLocale }: { serverLocale: string }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const syncingRef = useRef(false);

  useEffect(() => {
    const urlLocale = readUrlLocale(search);
    const bridgeLocale = readBridgeLocale(shopify);
    const targetLocale = urlLocale || bridgeLocale;

    if (!targetLocale || syncingRef.current) return;

    if (!urlLocale && bridgeLocale) {
      syncingRef.current = true;
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      params.set("locale", bridgeLocale);
      navigate(
        { search: params.toString() ? `?${params.toString()}` : "" },
        { replace: true },
      );
      syncingRef.current = false;
      return;
    }

    if (targetLocale !== serverLocale) {
      revalidator.revalidate();
    }
  }, [search, serverLocale, revalidator, navigate, shopify]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const bridgeLocale = readBridgeLocale(shopify);
    if (!bridgeLocale) return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const nextInit: RequestInit = { ...(init || {}) };
      const headers = new Headers(nextInit.headers || {});
      if (!headers.has(ADMIN_LOCALE_HEADER)) {
        headers.set(ADMIN_LOCALE_HEADER, bridgeLocale);
      }
      nextInit.headers = headers;
      return originalFetch(input, nextInit);
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [shopify]);

  return null;
}
