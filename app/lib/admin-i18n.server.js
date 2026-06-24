import en from "../../locales/en.json";
import {
  ADMIN_UI_LOCALES,
  normalizeAdminLocale,
  resolveAdminLocale,
} from "./admin-i18n.shared.js";

export { ADMIN_UI_LOCALES, normalizeAdminLocale, resolveAdminLocale };

const MESSAGE_LOADERS = {
  en: () => Promise.resolve(en),
  es: () => import("../../locales/es.json").then((m) => m.default ?? m),
  de: () => import("../../locales/de.json").then((m) => m.default ?? m),
  fr: () => import("../../locales/fr.json").then((m) => m.default ?? m),
};

const messageCache = new Map();

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * Load bundled locale JSON for the admin UI.
 */
async function loadBundledAdminMessages(locale) {
  const normalized = normalizeAdminLocale(locale);
  if (messageCache.has(normalized)) {
    return messageCache.get(normalized);
  }

  const loader = MESSAGE_LOADERS[normalized] || MESSAGE_LOADERS.en;
  const messages = await loader();
  messageCache.set(normalized, messages);
  return messages;
}

export async function loadAdminMessages(locale, options = {}) {
  const normalized = normalizeAdminLocale(locale);
  const { admin, shopDomain } = options;

  if (admin?.graphql && shopDomain) {
    try {
      const { loadDashboardMessagesFromMetaobject } = await import(
        "./dashboard/dashboard-i18n-metaobject.server.js"
      );
      const fromMeta = await loadDashboardMessagesFromMetaobject(
        admin,
        normalized,
        shopDomain,
      );
      if (fromMeta) return fromMeta;
    } catch (error) {
      console.warn("[admin-i18n] dashboard metaobject load failed:", error);
    }
  }

  return loadBundledAdminMessages(normalized);
}

export function createAdminTranslator(messages, fallbackMessages = en) {
  return function t(key, vars = {}) {
    let text =
      getByPath(messages, key) ??
      getByPath(fallbackMessages, key) ??
      key;

    if (typeof text !== "string") return key;

    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value ?? ""));
    }
    return text;
  };
}

/** Server-side translator for loaders and actions. */
export async function createServerI18n(request, session, options = {}) {
  const locale = resolveAdminLocale(request, session);
  const messages = await loadAdminMessages(locale, {
    admin: options.admin,
    shopDomain: options.shopDomain || session?.shop,
  });
  const t = createAdminTranslator(messages);
  return { locale, messages, t };
}
