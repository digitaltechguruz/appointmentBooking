import en from "../../../locales/en.json";
import { normalizeAdminLocale } from "../admin-i18n.shared.js";
import {
  DASHBOARD_SECTION_KEYS,
  getDashboardFieldGuide,
} from "./dashboard-i18n-messages.shared.js";

const ADMIN_UI_LOCALES = ["en", "es", "de", "fr"];

function normalizeDashboardLocale(locale) {
  const base = (locale || "en").toString().split("-")[0].trim().toLowerCase();
  return ADMIN_UI_LOCALES.includes(base) ? base : "en";
}

/**
 * Dashboard copy grouped by screen area. Each field stores pretty-printed JSON.
 * Merchants edit the quoted text values; keep keys unchanged.
 */
export const DASHBOARD_SECTIONS = [
  {
    key: "app",
    label: "App name",
    description: "App title in the admin. Key: name",
  },
  {
    key: "nav",
    label: "Navigation menu",
    description:
      "Top menu links. Keys: dashboard, services, availability, meetingTypes, bookings, settings, billing",
  },
  {
    key: "common",
    label: "Shared buttons & labels",
    description: "Save, remove, and other labels used across pages.",
  },
  {
    key: "validation",
    label: "Validation messages",
    description: "Error hints on forms.",
  },
  {
    key: "toast",
    label: "Success & error toasts",
    description: "Short messages after save, sync, and other actions.",
  },
  {
    key: "dashboard",
    label: "Dashboard page",
    description: "Home page headings and integration labels.",
  },
  {
    key: "services",
    label: "Services page",
    description: "Service list and form copy.",
  },
  {
    key: "availability",
    label: "Availability page",
    description: "Weekly hours and holidays copy.",
  },
  {
    key: "meetingTypes",
    label: "Meeting types page",
    description: "Meeting type list and form copy.",
  },
  {
    key: "bookings",
    label: "Bookings page",
    description: "Booking list and detail copy.",
  },
  {
    key: "settings",
    label: "Settings page",
    description: "Store languages, theme picker, and preview copy.",
  },
  {
    key: "billing",
    label: "Billing page",
    description: "Subscription status and plan copy.",
  },
  {
    key: "languages",
    label: "Languages & translations",
    description: "Widget sync, dashboard edit, and help text on Settings.",
  },
  {
    key: "banner",
    label: "Unsynced language banner",
    description: "Warning shown when widget text is not synced.",
  },
  {
    key: "catalog",
    label: "Catalog translations",
    description: "Service and meeting type translation banners and help text.",
  },
];

const BUNDLED_LOADERS = {
  en: () => Promise.resolve(en),
  es: () => import("../../../locales/es.json").then((m) => m.default ?? m),
  de: () => import("../../../locales/de.json").then((m) => m.default ?? m),
  fr: () => import("../../../locales/fr.json").then((m) => m.default ?? m),
};

const bundledCache = new Map();

export async function loadBundledDashboardMessages(locale) {
  const normalized = normalizeDashboardLocale(locale);
  if (bundledCache.has(normalized)) {
    return bundledCache.get(normalized);
  }

  const loader = BUNDLED_LOADERS[normalized] || BUNDLED_LOADERS.en;
  const messages = await loader();
  bundledCache.set(normalized, messages);
  return messages;
}

export function getDefaultDashboardSectionValues(messages) {
  const values = {};
  for (const section of DASHBOARD_SECTIONS) {
    const chunk = messages?.[section.key];
    values[section.key] =
      chunk && typeof chunk === "object"
        ? JSON.stringify(chunk, null, 2)
        : "{}";
  }
  return values;
}

export async function getDefaultDashboardSectionValuesForLanguage(language) {
  const messages = await loadBundledDashboardMessages(language);
  return getDefaultDashboardSectionValues(messages);
}

function parseSectionJson(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export { parseSectionJson };

/** True when every populated metaobject section equals the bundled locale JSON. */
export async function primarySectionsMatchBundled(primarySections, language) {
  const bundled = await loadBundledDashboardMessages(language);
  let compared = 0;

  for (const section of DASHBOARD_SECTIONS) {
    const primary = parseSectionJson(primarySections?.[section.key]);
    if (!primary) continue;
    compared += 1;
    const chunk = bundled[section.key];
    if (!chunk || JSON.stringify(primary) !== JSON.stringify(chunk)) {
      return false;
    }
  }

  return compared > 0;
}

export function buildDashboardMessagesFromSections(sectionValues, fallbackMessages) {
  const messages = structuredClone(fallbackMessages);

  for (const section of DASHBOARD_SECTIONS) {
    const parsed = parseSectionJson(sectionValues?.[section.key]);
    if (parsed) {
      messages[section.key] = {
        ...(messages[section.key] || {}),
        ...parsed,
      };
    }
  }

  return messages;
}

const FALLBACK_DEFINITION_NAME = "Dashboard Text";
const FALLBACK_LANGUAGE_FIELD_NAME = "Dashboard language";
const FALLBACK_LANGUAGE_FIELD_DESCRIPTION =
  "Display name for this entry (set automatically from your Admin language).";

/** Admin metaobject editor labels — localized from bundled locale JSON. */
export async function loadDashboardDefinitionLabels(uiLocale) {
  const messages = await loadBundledDashboardMessages(
    normalizeAdminLocale(uiLocale),
  );
  const languages = messages?.languages || {};
  const dashboardFields = languages.dashboardFields || {};
  const languageNames = languages.lang || {};

  const sections = DASHBOARD_SECTION_KEYS.map((key) => {
    const field = dashboardFields[key] || {};
    const fallback = DASHBOARD_SECTIONS.find((section) => section.key === key);
    return {
      key,
      name: field.label || fallback?.label || key,
      description: field.description || fallback?.description || "",
    };
  });

  return {
    definitionName:
      languages.dashboardDefinitionName || FALLBACK_DEFINITION_NAME,
    languageFieldName:
      languages.dashboardLanguageFieldName || FALLBACK_LANGUAGE_FIELD_NAME,
    languageFieldDescription:
      languages.dashboardLanguageFieldDescription ||
      FALLBACK_LANGUAGE_FIELD_DESCRIPTION,
    languageNames,
    sections,
  };
}

export { DASHBOARD_SECTION_KEYS, getDashboardFieldGuide };
