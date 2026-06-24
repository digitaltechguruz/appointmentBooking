/** Admin UI locales shipped with the app. Add a JSON file + server loader to extend. */
export const ADMIN_UI_LOCALES = ["en", "es", "de", "fr"];

/**
 * Normalize Shopify Admin locale (e.g. es-ES, en-US) to app UI language code.
 */
export function normalizeAdminLocale(locale) {
  const base = (locale || "en").toString().split("-")[0].trim().toLowerCase();
  return ADMIN_UI_LOCALES.includes(base) ? base : "en";
}

/** Read staff locale stored on the OAuth session (online tokens only). */
export function localeFromSession(session) {
  if (!session) return null;
  return (
    session.locale ||
    session.onlineAccessInfo?.associated_user?.locale ||
    null
  );
}

/**
 * Resolve embedded Admin UI language.
 * Shopify passes the current staff locale on each iframe load via ?locale= — prefer
 * that over a stale session value saved at install/login time.
 */
export function resolveAdminLocale(request, session) {
  try {
    const fromUrl = new URL(request.url).searchParams.get("locale");
    if (fromUrl) return normalizeAdminLocale(fromUrl);
  } catch {
    // ignore
  }

  const fromSession = localeFromSession(session);
  if (fromSession) return normalizeAdminLocale(fromSession);

  const accept = request.headers.get("Accept-Language")?.split(",")[0];
  if (accept) return normalizeAdminLocale(accept);

  return "en";
}

/** Language used to seed the Dashboard Text metaobject (staff Admin UI language). */
export function resolveDashboardSeedLanguage(uiLocale) {
  return normalizeAdminLocale(uiLocale || "en");
}

/** Parse "English (en)" or "es" from the metaobject language display field. */
export function parseDashboardSeedLanguageFromFieldValue(value) {
  if (!value) return null;
  const raw = value.toString().trim();
  const parenMatch = raw.match(/\(([a-z]{2})\)\s*$/i);
  if (parenMatch) {
    return normalizeAdminLocale(parenMatch[1]);
  }
  return normalizeAdminLocale(raw);
}

/** Shop locale name in the admin UI language (e.g. "Inglés" when UI is es). */
export function shopLocaleDisplayName(localeCode, uiLocale, fallbackName) {
  const base = (localeCode || "").toString().split("-")[0].trim();
  if (!base) return fallbackName || localeCode || "";

  try {
    const intlLocale =
      uiLocale === "en"
        ? "en-US"
        : uiLocale === "es"
          ? "es-ES"
          : uiLocale === "de"
            ? "de-DE"
            : uiLocale === "fr"
              ? "fr-FR"
              : uiLocale;
    const display = new Intl.DisplayNames([intlLocale], { type: "language" });
    const localized = display.of(base);
    if (localized) {
      return localized.charAt(0).toUpperCase() + localized.slice(1);
    }
  } catch {
    // ignore
  }

  return fallbackName || localeCode;
}
