import { useEffect } from "react";
import { useLocation, useRevalidator } from "react-router";
import { normalizeAdminLocale } from "../../lib/admin-i18n.shared.js";

function readEmbeddedLocale(search: string) {
  const fromUrl = new URLSearchParams(search).get("locale");
  if (fromUrl) return normalizeAdminLocale(fromUrl);

  if (typeof shopify !== "undefined" && shopify?.config?.locale) {
    return normalizeAdminLocale(shopify.config.locale);
  }

  return null;
}

/** Re-fetch loader data when Shopify Admin language changes (URL or App Bridge locale). */
export function AdminLocaleSync({ serverLocale }: { serverLocale: string }) {
  const { search } = useLocation();
  const revalidator = useRevalidator();

  useEffect(() => {
    const embeddedLocale = readEmbeddedLocale(search);
    if (!embeddedLocale || embeddedLocale === serverLocale) return;
    revalidator.revalidate();
  }, [search, serverLocale, revalidator]);

  return null;
}
