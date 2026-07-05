import { TRANSLATION_FIELDS, SUPPORTED_LANGUAGES } from "./widget-text.constants.js";
import {
  CACHE_TTL,
  getShopCache,
  invalidateShopCache,
  setShopCache,
} from "../shop-cache.server.js";
import {
  getDefaultTranslationValues,
  parseCustomTranslations,
} from "./widget-text.translations.js";
import { loadWidgetDefinitionLabels } from "./widget-i18n-messages.server.js";

/** App-owned type from deploy — not visible in Translate & Adapt. */
const APP_METAOBJECT_TYPE = "$app:booking_widget_text";
/** Merchant-owned type — required for Translate & Adapt. */
export const MERCHANT_WIDGET_TEXT_TYPE = "ab_booking_widget_text";
/** Single entry — Translate & Adapt translates fields per locale on this entry. */
const WIDGET_TEXT_HANDLE = "default";
const LANGUAGE_FIELD_KEY = "language";
const DISPLAY_NAME_FIELD_KEY = "language";

const LANGUAGE_LABEL_BY_CODE = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.value, l.label]),
);

const TRANSLATION_FIELD_KEY_SET = new Set(TRANSLATION_FIELDS.map((field) => field.key));

/** Translation field keys stored on this metaobject entry (excludes language display). */
function translationFieldKeysOnEntry(entry) {
  if (!entry?.fields?.length) return [];
  return entry.fields
    .map((field) => field.key)
    .filter((key) => key && key !== LANGUAGE_FIELD_KEY && TRANSLATION_FIELD_KEY_SET.has(key));
}

/** Serialize metaobject entry ensure per shop + type (prevents parallel duplicate creates). */
const widgetTextEntryLocks = new Map();

const SUPPORTED_LANGUAGE_CODES = new Set(
  SUPPORTED_LANGUAGES.map((l) => l.value),
);

export function localeToLanguage(locale) {
  if (!locale) return null;
  const part = locale.toString().split("-")[0].trim().toLowerCase();
  return part || null;
}

/** Locale string for Shopify translations API (any published shop locale, e.g. fr, fr-CA). */
function shopLocaleForTranslations(locale) {
  const code = normalizeShopLocale(locale);
  if (!code) return null;
  return code.replace(/_/g, "-");
}

function localesEquivalent(a, b) {
  const na = shopLocaleForTranslations(a)?.toLowerCase();
  const nb = shopLocaleForTranslations(b)?.toLowerCase();
  if (!na || !nb) return na === nb;
  if (na === nb) return true;
  return na.split("-")[0] === nb.split("-")[0];
}

export function normalizeLanguage(code) {
  const normalized = (code || "").toString().trim().toLowerCase();
  if (!normalized) return null;
  if (SUPPORTED_LANGUAGE_CODES.has(normalized)) return normalized;
  return null;
}

export function mapToSupportedLanguage(code) {
  return normalizeLanguage(code) || "en";
}

/** Language used to seed the Default metaobject (app-supported, else English). */
export function resolveMetaobjectSeedLanguage(primaryLocaleOrLanguage) {
  const fromLocale = localeToLanguage(primaryLocaleOrLanguage);
  const candidate = fromLocale || primaryLocaleOrLanguage;
  return normalizeLanguage(candidate) || "en";
}

export async function fetchShopPrimaryLocale(admin, shopDomain) {
  if (!admin?.graphql) return { locale: "en", language: "en" };

  if (shopDomain) {
    const cached = getShopCache(shopDomain, "primary-locale");
    if (cached) return cached;
  }

  try {
    const primaryRow =
      (await queryShopPrimaryLocaleRow(admin)) ||
      (await queryShopLocales(admin)).rows.find((row) => row.primary);
    if (primaryRow?.locale) {
      const locale = normalizeShopLocale(primaryRow.locale);
      const language = localeToLanguage(locale) || locale.split("-")[0].toLowerCase();
      const result = { locale, language };
      if (shopDomain) setShopCache(shopDomain, "primary-locale", result);
      return result;
    }
  } catch (error) {
    console.warn("[shopify] shopLocales primary:", error);
  }

  try {
    const response = await admin.graphql(
      `#graphql
      query ShopPrimaryLocale {
        shop {
          primaryLocale {
            locale
            language
          }
        }
      }`,
    );
    const { data, errors } = await response.json();
    if (errors?.length) {
      console.warn("[shopify] shop.primaryLocale:", errors.map((e) => e.message).join("; "));
      return { locale: "en", language: "en" };
    }

    const primary = data?.shop?.primaryLocale;
    const locale =
      normalizeShopLocale(primary?.locale) ||
      normalizeShopLocale(primary?.language) ||
      "en";
    const language = localeToLanguage(locale) || "en";
    const result = { locale, language };
    if (shopDomain) setShopCache(shopDomain, "primary-locale", result);
    return result;
  } catch (error) {
    console.warn("[shopify] shop.primaryLocale:", error);
    return { locale: "en", language: "en" };
  }
}

export async function getMetaobjectSeedLanguage(admin, shopDomain) {
  const { locale, language } = await fetchShopPrimaryLocale(admin, shopDomain);
  return resolveMetaobjectSeedLanguage(locale || language);
}

export async function fetchShopPrimaryLanguage(admin, shopDomain) {
  return getMetaobjectSeedLanguage(admin, shopDomain);
}

function graphqlResponseErrors(json) {
  if (!json?.errors?.length) return "";
  return json.errors.map((e) => e.message).join("; ");
}

function mutationUserErrors(payload, operation) {
  const errors = payload?.userErrors?.filter((e) => e.message);
  if (!errors?.length) return null;
  return `${operation}: ${errors.map((e) => e.message).join(", ")}`;
}

/**
 * Fetch shop locales (requires `read_locales` scope).
 * @see https://shopify.dev/docs/api/admin-graphql/latest/queries/shopLocales
 */
/** Primary locale (published or not) — used for seeding default widget text. */
async function queryShopPrimaryLocaleRow(admin) {
  if (!admin?.graphql) return null;

  try {
    const response = await admin.graphql(
      `#graphql
      query ShopPrimaryLocaleRow {
        shopLocales {
          locale
          name
          primary
          published
        }
      }`,
    );
    const { data, errors } = await response.json();
    if (errors?.length) {
      console.warn("[shopify] shopLocales primary row:", errors.map((e) => e.message).join("; "));
      return null;
    }
    return (data?.shopLocales || []).find((row) => row?.primary && row?.locale) || null;
  } catch (error) {
    console.warn("[shopify] shopLocales primary row:", error);
    return null;
  }
}

function widgetTextEntryIsPopulated(entry) {
  if (!entry?.id) return false;
  const stored = parseMetaobjectFields(entry.fields);
  return TRANSLATION_FIELDS.some((field) => Boolean(stored[field.key]?.trim()));
}

/** Stricter check — all translation fields on this entry must have content. */
function widgetTextEntryIsFullyPopulated(entry) {
  if (!entry?.id) return false;
  const stored = parseMetaobjectFields(entry.fields);
  const keysOnEntry = translationFieldKeysOnEntry(entry);
  const fieldsToCheck =
    keysOnEntry.length > 0
      ? TRANSLATION_FIELDS.filter((field) => keysOnEntry.includes(field.key))
      : TRANSLATION_FIELDS;
  return (
    fieldsToCheck.length > 0 &&
    fieldsToCheck.every((field) => Boolean(stored[field.key]?.trim()))
  );
}

function widgetTextEntryNeedsBackfill(entry) {
  if (!entry?.id) return true;
  const stored = parseMetaobjectFields(entry.fields);
  const keysOnEntry = translationFieldKeysOnEntry(entry);
  const fieldsToCheck =
    keysOnEntry.length > 0
      ? TRANSLATION_FIELDS.filter((field) => keysOnEntry.includes(field.key))
      : TRANSLATION_FIELDS;
  return fieldsToCheck.some((field) => !stored[field.key]?.trim());
}

async function queryShopLocales(admin) {
  if (!admin?.graphql) {
    return { rows: [], error: "Admin API unavailable" };
  }

  try {
    const response = await admin.graphql(
      `#graphql
      query ShopLocalesList {
        shopLocales(published: true) {
          locale
          name
          primary
          published
        }
      }`,
    );
    const { data, errors } = await response.json();

    if (errors?.length) {
      const message = errors.map((e) => e.message).join("; ");
      console.warn("[shopify] shopLocales:", message);
      return { rows: [], error: message };
    }

    const rows = (data?.shopLocales || []).filter((row) => row?.locale);

    return { rows, error: null };
  } catch (error) {
    const message = error?.message || "Failed to load shop locales";
    console.warn("[shopify] shopLocales:", message);
    return { rows: [], error: message };
  }
}

/** Published shop locales that match app-supported languages (for admin language list). */
export async function fetchShopLanguagesForWidgetEntries(admin) {
  const { rows } = await queryShopLocales(admin);
  const langs = new Set();

  for (const row of rows) {
    const supported = normalizeLanguage(localeToLanguage(row.locale));
    if (supported) langs.add(supported);
  }

  return langs.size > 0 ? Array.from(langs) : ["en"];
}

function buildTranslationValues(language, stored = {}) {
  const defaults = getDefaultTranslationValues(language);
  const values = {};
  for (const field of TRANSLATION_FIELDS) {
    const raw = stored[field.key];
    const trimmed =
      raw !== undefined && raw !== null ? String(raw).trim() : "";
    values[field.key] = trimmed || defaults[field.key] || "";
  }
  return values;
}

function buildFieldsPayload(language, values = {}) {
  const merged = buildTranslationValues(language, values);
  return TRANSLATION_FIELDS.map((f) => ({
    key: f.key,
    value: merged[f.key] || "",
  }));
}

function parseMetaobjectFields(fields) {
  const map = Object.fromEntries((fields || []).map((f) => [f.key, f.value]));
  const translations = {};
  for (const field of TRANSLATION_FIELDS) {
    const val = map[field.key]?.toString().trim();
    if (val) translations[field.key] = val;
  }
  return translations;
}

const WIDGET_TEXT_DEFINITION_NAME = "Book appointment widget text";

/** Shopify only allows `access.admin` on app-reserved types ($app:…). */
function accessForMetaobjectType(type) {
  if (isAppOwnedMetaobjectType(type)) {
    return {
      admin: "MERCHANT_READ_WRITE",
      storefront: "PUBLIC_READ",
    };
  }
  return { storefront: "PUBLIC_READ" };
}

const TRANSLATABLE_DEFINITION = {
  name: WIDGET_TEXT_DEFINITION_NAME,
  type: MERCHANT_WIDGET_TEXT_TYPE,
  capabilities: {
    translatable: { enabled: true },
  },
  displayNameKey: DISPLAY_NAME_FIELD_KEY,
  fieldDefinitions: [
    {
      key: LANGUAGE_FIELD_KEY,
      name: "Widget language",
      type: "single_line_text_field",
      required: false,
    },
    ...TRANSLATION_FIELDS.map((f) => ({
      key: f.key,
      name: f.label,
      type: "single_line_text_field",
      required: false,
    })),
  ],
};

export const WIDGET_TEXT_REQUIRED_SCOPES = [
  "write_metaobject_definitions",
  "write_metaobjects",
  "read_metaobject_definitions",
  "read_metaobjects",
];

export function getMissingWidgetTextScopes(scopeString) {
  const granted = new Set(
    (scopeString || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return WIDGET_TEXT_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
}

function formatWidgetLanguageFieldValue(language, languageNames = {}) {
  const code = normalizeLanguage(language) || "en";
  const label =
    languageNames[code] ||
    LANGUAGE_LABEL_BY_CODE[code] ||
    code.toUpperCase();
  return `${label} (${code})`;
}

async function getDefinitionFieldKeys(admin, metaobjectType = MERCHANT_WIDGET_TEXT_TYPE) {
  try {
    const res = await admin.graphql(
      `#graphql
      query WidgetTextDefinitionFields($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          fieldDefinitions {
            key
          }
        }
      }`,
      { variables: { type: metaobjectType } },
    );
    const { data } = await res.json();
    return (
      data?.metaobjectDefinitionByType?.fieldDefinitions?.map((f) => f.key) ||
      []
    );
  } catch {
    return [];
  }
}

async function queryDefinitionFieldDefinitions(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query WidgetTextDefinitionFieldsFull($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          fieldDefinitions {
            key
            name
          }
        }
      }`,
      { variables: { type: metaobjectType } },
    );
    const { data } = await res.json();
    return data?.metaobjectDefinitionByType?.fieldDefinitions || [];
  } catch {
    return [];
  }
}

async function ensureDefinitionFieldDefinitions(
  admin,
  definitionId,
  metaobjectType,
  labels,
) {
  if (!definitionId || !labels) return;

  try {
    const existingFields = await queryDefinitionFieldDefinitions(admin, metaobjectType);
    const keys = existingFields.map((f) => f.key);
    const nameByKey = Object.fromEntries(
      existingFields.map((f) => [f.key, f.name]),
    );
    const fieldOps = [];

    if (!keys.includes(LANGUAGE_FIELD_KEY)) {
      fieldOps.push({
        create: {
          key: LANGUAGE_FIELD_KEY,
          name: labels.languageFieldName,
          type: "single_line_text_field",
        },
      });
    } else if (nameByKey[LANGUAGE_FIELD_KEY] !== labels.languageFieldName) {
      fieldOps.push({
        update: { key: LANGUAGE_FIELD_KEY, name: labels.languageFieldName },
      });
    }

    for (const field of labels.fields) {
      if (!keys.includes(field.key)) {
        fieldOps.push({
          create: {
            key: field.key,
            name: field.name,
            type: "single_line_text_field",
          },
        });
      } else if (nameByKey[field.key] !== field.name) {
        fieldOps.push({
          update: { key: field.key, name: field.name },
        });
      }
    }

    if (fieldOps.length === 0) return;

    await admin.graphql(
      `#graphql
      mutation UpdateWidgetTextDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: definitionId,
          definition: {
            displayNameKey: DISPLAY_NAME_FIELD_KEY,
            fieldDefinitions: fieldOps,
          },
        },
      },
    );
  } catch (error) {
    console.warn("[metaobject] definition admin fields:", error);
  }
}

async function ensureWidgetDefinitionName(admin, definition, labels) {
  if (
    !definition?.id ||
    isAppOwnedMetaobjectType(definition.type) ||
    !labels?.definitionName ||
    definition.name === labels.definitionName
  ) {
    return;
  }

  try {
    await admin.graphql(
      `#graphql
      mutation UpdateWidgetDefinitionName($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: definition.id,
          definition: { name: labels.definitionName },
        },
      },
    );
  } catch (error) {
    console.warn("[metaobject] definition name:", error);
  }
}

async function buildUpsertFields(
  admin,
  metaobjectType,
  language,
  values = {},
  languageNames = {},
) {
  const lang = normalizeLanguage(language) || "en";
  const merged = buildTranslationValues(lang, values);
  let definitionKeys = await getDefinitionFieldKeys(admin, metaobjectType);

  if (definitionKeys.length === 0) {
    definitionKeys = [
      LANGUAGE_FIELD_KEY,
      ...TRANSLATION_FIELDS.map((field) => field.key),
    ];
  }

  const fields = TRANSLATION_FIELDS.filter((field) =>
    definitionKeys.includes(field.key),
  ).map((field) => ({
    key: field.key,
    value: merged[field.key] || "",
  }));

  if (definitionKeys.includes(LANGUAGE_FIELD_KEY)) {
    return [
      {
        key: LANGUAGE_FIELD_KEY,
        value: formatWidgetLanguageFieldValue(lang, languageNames),
      },
      ...fields,
    ];
  }

  return fields;
}

async function updateWidgetTextEntryById(admin, entryId, fields) {
  if (!entryId || !fields?.length) return null;

  const result = await admin.graphql(
    `#graphql
    mutation UpdateWidgetTextEntry($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject {
          id
          handle
          type
          fields {
            key
            value
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        id: entryId,
        metaobject: {
          fields: fields.map((field) => ({ key: field.key, value: field.value })),
        },
      },
    },
  );
  const json = await result.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) throw new Error(gqlError);

  const payload = json?.data?.metaobjectUpdate;
  const userError = mutationUserErrors(payload, "metaobjectUpdate");
  if (userError) throw new Error(userError);

  return payload?.metaobject || null;
}

function metaobjectGidToNumericId(gid) {
  if (!gid) return null;
  const match = String(gid).match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

function isAppOwnedMetaobjectType(type) {
  const t = (type || "").toString();
  return t.startsWith("$app:") || t.includes("app--");
}

async function listMetaobjectDefinitions(admin) {
  try {
    const res = await admin.graphql(
      `#graphql
      query WidgetTextDefinitionScan {
        metaobjectDefinitions(first: 50) {
          nodes {
            id
            type
            name
            displayNameKey
            capabilities {
              translatable { enabled }
            }
          }
        }
      }`,
    );
    const json = await res.json();
    return json?.data?.metaobjectDefinitions?.nodes || [];
  } catch (error) {
    console.warn("[metaobject] definition scan:", error);
    return [];
  }
}

function isWidgetTextDefinitionName(name) {
  const n = (name || "").toString().toLowerCase();
  return (
    n.includes("book appointment widget text") ||
    n.includes("booking widget text") ||
    n.includes("widget text") ||
    n.includes("appointment booking")
  );
}

async function findAppOwnedWidgetTextDefinition(admin) {
  const fromToml = await queryDefinitionByType(admin, APP_METAOBJECT_TYPE);
  if (fromToml?.id) return fromToml;

  const nodes = await listMetaobjectDefinitions(admin);
  return (
    nodes.find(
      (n) => isWidgetTextDefinitionName(n?.name) && isAppOwnedMetaobjectType(n?.type),
    ) ||
    nodes.find(
      (n) =>
        (n?.type || "").includes("booking_widget_text") &&
        isAppOwnedMetaobjectType(n?.type),
    ) ||
    null
  );
}

/**
 * Prefer the app-deployed definition from shopify.app.toml — that is what
 * merchants see as "Book appointment widget text" in Shopify admin.
 */
async function resolvePrimaryWidgetTextDefinition(admin, steps = []) {
  const deployedApp = await findAppOwnedWidgetTextDefinition(admin);
  if (deployedApp?.id) {
    steps.push(
      `Using deploy definition (${deployedApp.type}). Entries appear under Content → Metaobjects.`,
    );
    return { ...deployedApp, type: deployedApp.type || APP_METAOBJECT_TYPE };
  }

  const merchant = await queryDefinitionByType(admin, MERCHANT_WIDGET_TEXT_TYPE);
  if (merchant?.id) {
    steps.push(`Found merchant definition (${merchant.type})`);
    return merchant;
  }

  const scanned = await findWidgetTextDefinitionByScan(admin);
  if (scanned?.id) {
    steps.push(`Found definition via scan (${scanned.type})`);
    return scanned;
  }

  return null;
}

async function findWidgetTextDefinitionByScan(admin) {
  const nodes = await listMetaobjectDefinitions(admin);

  const merchant = nodes.find(
    (n) =>
      isWidgetTextDefinitionName(n?.name) &&
      n?.type &&
      !isAppOwnedMetaobjectType(n.type),
  );
  if (merchant?.id) return { ...merchant, type: merchant.type };

  const byType = nodes.find((n) => n?.type === MERCHANT_WIDGET_TEXT_TYPE);
  if (byType?.id) return { ...byType, type: byType.type };

  const appOwned = nodes.find(
    (n) => isWidgetTextDefinitionName(n?.name) && isAppOwnedMetaobjectType(n?.type),
  );
  if (appOwned?.id) return { ...appOwned, type: appOwned.type };

  return null;
}

async function queryDefinitionByType(admin, type) {
  const response = await admin.graphql(
    `#graphql
    query MetaobjectDefinitionByType($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        id
        type
        displayNameKey
        capabilities {
          translatable { enabled }
        }
      }
    }`,
    { variables: { type } },
  );
  const json = await response.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) {
    console.warn(`[metaobject] definition query (${type}):`, gqlError);
    return null;
  }
  const row = json?.data?.metaobjectDefinitionByType;
  if (!row?.id) return null;
  return { ...row, type: row.type || type };
}

async function enableTranslatableOnDefinition(admin, def) {
  if (!def?.id || def.capabilities?.translatable?.enabled) return;

  try {
    await admin.graphql(
      `#graphql
      mutation EnableTranslatable($id: ID!) {
        metaobjectDefinitionUpdate(
          id: $id
          definition: { capabilities: { translatable: { enabled: true } } }
        ) {
          userErrors { field message }
        }
      }`,
      { variables: { id: def.id } },
    );
  } catch (error) {
    console.warn("[metaobject] Could not enable translatable:", error);
  }
}

async function runMetaobjectDefinitionCreate(admin, definitionInput, label) {
  const created = await admin.graphql(
    `#graphql
    mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          type
          name
          capabilities {
            translatable { enabled }
          }
        }
        userErrors { field message }
      }
    }`,
    { variables: { definition: definitionInput } },
  );
  const createdJson = await created.json();
  const gqlError = graphqlResponseErrors(createdJson);
  if (gqlError) {
    throw new Error(`${label}: ${gqlError}`);
  }

  const payload = createdJson?.data?.metaobjectDefinitionCreate;
  const userError = mutationUserErrors(payload, "metaobjectDefinitionCreate");
  const createType = definitionInput?.type;

  if (userError) {
    if (
      createType &&
      /already|taken|exists|in use/i.test(userError)
    ) {
      const existing = await queryDefinitionByType(admin, createType);
      if (existing?.id) {
        return { ...existing, type: existing.type || createType };
      }
    }
    throw new Error(`${label}: ${userError}`);
  }

  const def = payload?.metaobjectDefinition;
  if (!def?.id) {
    if (createType) {
      const existing = await queryDefinitionByType(admin, createType);
      if (existing?.id) {
        return { ...existing, type: existing.type || createType };
      }
    }
    throw new Error(`${label}: metaobjectDefinitionCreate returned no definition`);
  }
  return { ...def, type: def.type || createType || MERCHANT_WIDGET_TEXT_TYPE };
}

function widgetTextDefinitionCreateBase(type, labels) {
  return {
    name: labels.definitionName || WIDGET_TEXT_DEFINITION_NAME,
    type,
    displayNameKey: DISPLAY_NAME_FIELD_KEY,
    access: accessForMetaobjectType(type),
    fieldDefinitions: [
      {
        key: LANGUAGE_FIELD_KEY,
        name: labels.languageFieldName,
        type: "single_line_text_field",
        required: false,
      },
      ...labels.fields.map((field) => ({
        key: field.key,
        name: field.name,
        type: "single_line_text_field",
        required: false,
      })),
    ],
  };
}

async function createMerchantWidgetTextDefinition(admin, labels) {
  const base = widgetTextDefinitionCreateBase(MERCHANT_WIDGET_TEXT_TYPE, labels);

  const attempts = [
    {
      label: "full definition with translatable",
      definition: { ...base, capabilities: TRANSLATABLE_DEFINITION.capabilities },
    },
    {
      label: "full definition without translatable capability",
      definition: base,
    },
    {
      label: "minimal definition",
      definition: {
        ...base,
        fieldDefinitions: labels.fields.slice(0, 6).map((field) => ({
          key: field.key,
          name: field.name,
          type: "single_line_text_field",
          required: false,
        })),
      },
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await runMetaobjectDefinitionCreate(
        admin,
        attempt.definition,
        attempt.label,
      );
    } catch (error) {
      lastError = error?.message || String(error);
      console.warn(`[metaobject] create attempt failed (${attempt.label}):`, lastError);
    }
  }

  throw new Error(lastError || "Could not create metaobject definition");
}

/** App-reserved type (same as shopify.app.toml) — works without deploy if scopes allow. */
async function createAppOwnedWidgetTextDefinition(admin, labels) {
  const base = widgetTextDefinitionCreateBase(APP_METAOBJECT_TYPE, labels);

  const attempts = [
    {
      label: "app-owned with translatable",
      definition: { ...base, capabilities: TRANSLATABLE_DEFINITION.capabilities },
    },
    {
      label: "app-owned without translatable capability",
      definition: base,
    },
    {
      label: "app-owned minimal fields",
      definition: {
        ...base,
        fieldDefinitions: labels.fields.slice(0, 6).map((field) => ({
          key: field.key,
          name: field.name,
          type: "single_line_text_field",
          required: false,
        })),
      },
    },
    {
      label: "app-owned shell (fields added on first entry)",
      definition: {
        name: labels.definitionName || WIDGET_TEXT_DEFINITION_NAME,
        type: APP_METAOBJECT_TYPE,
        displayNameKey: DISPLAY_NAME_FIELD_KEY,
        access: accessForMetaobjectType(APP_METAOBJECT_TYPE),
      },
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await runMetaobjectDefinitionCreate(
        admin,
        attempt.definition,
        attempt.label,
      );
    } catch (error) {
      lastError = error?.message || String(error);
      console.warn(`[metaobject] app create failed (${attempt.label}):`, lastError);
    }
  }

  throw new Error(lastError || "Could not create app-owned metaobject definition");
}

/**
 * @returns {{ definition: object|null, error: string|null, steps: string[] }}
 */
export async function ensureDefinitionWithDiagnostics(admin, options = {}) {
  const steps = [];
  if (!admin?.graphql) {
    return { definition: null, error: "Admin API unavailable", steps };
  }

  const uiLocale = options.uiLocale || "en";
  const labels = await loadWidgetDefinitionLabels(uiLocale);

  let def = await resolvePrimaryWidgetTextDefinition(admin, steps);

  if (!def?.id) {
    steps.push("Creating merchant-owned definition (ab_booking_widget_text)…");
    try {
      def = await createMerchantWidgetTextDefinition(admin, labels);
      steps.push(`Created merchant definition (${def.type})`);
    } catch (error) {
      const message = error?.message || "Create failed";
      steps.push(`Merchant create failed: ${message}`);
    }
  }

  if (!def?.id) {
    steps.push("Creating app-owned definition ($app:booking_widget_text)…");
    try {
      def = await createAppOwnedWidgetTextDefinition(admin, labels);
      steps.push(`Created app definition (${def.type})`);
    } catch (error) {
      const message = error?.message || "Create failed";
      steps.push(`App-owned create failed: ${message}`);
    }
  }

  if (!def?.id) {
    def = await findAppOwnedWidgetTextDefinition(admin);
    if (def?.id) {
      steps.push(
        `Using app definition from deploy (${def.type}). Visible under Admin → Content → Metaobjects.`,
      );
    }
  }

  if (!def?.id) {
    return {
      definition: null,
      error:
        "Could not create a metaobject definition. Re-open the app (re-approve scopes if prompted), open Settings, and click Sync translation. You can also run shopify app deploy from the app folder.",
      steps,
    };
  }

  const metaobjectType = def.type || MERCHANT_WIDGET_TEXT_TYPE;
  if (!isAppOwnedMetaobjectType(def.type)) {
    await enableTranslatableOnDefinition(admin, def);
    steps.push("Translatable capability enabled (merchant definition)");
    await ensureWidgetDefinitionName(admin, def, labels);
  } else {
    steps.push("Using app-deployed definition (fields from shopify.app.toml)");
  }
  await ensureDefinitionFieldDefinitions(admin, def.id, metaobjectType, labels);
  steps.push("Definition fields and display name verified");

  return { definition: def, error: null, steps };
}

/** Sync widget metaobject admin field labels to the staff Admin UI language. */
export async function syncWidgetDefinitionLabels(
  admin,
  uiLocale = "en",
  shopDomain,
) {
  const { definition } = await ensureDefinitionWithDiagnostics(admin, {
    uiLocale,
  });
  if (!definition?.id || !shopDomain) return definition;

  try {
    const metaobjectType = definition.type || MERCHANT_WIDGET_TEXT_TYPE;
    const labels = await loadWidgetDefinitionLabels(uiLocale);
    const entry =
      (await getWidgetTextMetaobject(admin, metaobjectType)) ||
      pickCanonicalWidgetTextEntry(
        await listWidgetTextEntries(admin, metaobjectType),
      );
    if (!entry?.id) return definition;

    const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
    const languageValue = formatWidgetLanguageFieldValue(
      seedLanguage,
      labels.languageNames,
    );
    const currentMap = Object.fromEntries(
      (entry.fields || []).map((field) => [field.key, field.value]),
    );
    if (currentMap[LANGUAGE_FIELD_KEY] !== languageValue) {
      await admin.graphql(
        `#graphql
        mutation UpdateWidgetLanguageLabel($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            userErrors { field message }
          }
        }`,
        {
          variables: {
            id: entry.id,
            metaobject: {
              fields: [{ key: LANGUAGE_FIELD_KEY, value: languageValue }],
            },
          },
        },
      );
    }
  } catch (error) {
    console.warn("[metaobject] language display field:", error);
  }

  return definition;
}

async function migrateAppOwnedEntryToMerchant(admin, shopDomain) {
  const def = await resolvePrimaryWidgetTextDefinition(admin);
  if (!def?.type || isAppOwnedMetaobjectType(def.type)) {
    return;
  }

  const metaobjectType = def.type;
  const merchantEntry = await getWidgetTextMetaobject(admin, metaobjectType);
  if (merchantEntry?.id) return;

  let appEntry = await getWidgetTextMetaobject(admin, APP_METAOBJECT_TYPE);
  if (!appEntry?.fields?.length) {
    const appDefs = await queryDefinitionByType(admin, APP_METAOBJECT_TYPE);
    const appType = appDefs?.type;
    if (appType) {
      appEntry = await findWidgetTextEntryByList(admin, appType);
    }
  }
  if (!appEntry?.fields?.length) return;

  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const stored = parseMetaobjectFields(appEntry.fields);
  await deduplicateWidgetTextEntries(admin, metaobjectType, shopDomain);
  await upsertPrimaryWidgetText(admin, metaobjectType, seedLanguage, stored);
}

async function ensureDefinition(admin, options = {}) {
  const { definition } = await ensureDefinitionWithDiagnostics(admin, options);
  return definition;
}

async function getWidgetTextMetaobject(admin, metaobjectType) {
  const res = await admin.graphql(
    `#graphql
    query WidgetTextMetaobject($handle: MetaobjectHandleInput!) {
      metaobjectByHandle(handle: $handle) {
        id
        handle
        type
        fields {
          key
          value
        }
      }
    }`,
    {
      variables: {
        handle: { type: metaobjectType, handle: WIDGET_TEXT_HANDLE },
      },
    },
  );
  const json = await res.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) {
    console.warn(`[metaobject] metaobjectByHandle (${metaobjectType}):`, gqlError);
  }
  return json?.data?.metaobjectByHandle || null;
}

async function listWidgetTextEntries(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query WidgetTextEntries($type: String!) {
        metaobjects(type: $type, first: 20) {
          nodes {
            id
            handle
            type
            fields {
              key
              value
            }
          }
        }
      }`,
      { variables: { type: metaobjectType } },
    );
    const json = await res.json();
    return json?.data?.metaobjects?.nodes || [];
  } catch {
    return [];
  }
}

function pickCanonicalWidgetTextEntry(nodes) {
  if (!nodes?.length) return null;
  return (
    nodes.find((n) => n?.handle === WIDGET_TEXT_HANDLE) ||
    nodes.find((n) => widgetTextEntryIsPopulated(n)) ||
    nodes[0] ||
    null
  );
}

async function deleteMetaobjectEntry(admin, id) {
  if (!id) return;

  try {
    const result = await admin.graphql(
      `#graphql
      mutation DeleteMetaobjectEntry($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }`,
      { variables: { id } },
    );
    const json = await result.json();
    const errs = json?.data?.metaobjectDelete?.userErrors;
    if (errs?.length) {
      console.warn(
        "[metaobject] metaobjectDelete:",
        errs.map((e) => e.message).join(", "),
      );
    }
  } catch (error) {
    console.warn("[metaobject] metaobjectDelete:", error);
  }
}

/** Keep a single default entry; remove extras from parallel provision races. */
async function deduplicateWidgetTextEntriesUnlocked(admin, metaobjectType) {
  const nodes = await listWidgetTextEntries(admin, metaobjectType);
  if (nodes.length <= 1) {
    return pickCanonicalWidgetTextEntry(nodes);
  }

  const canonical = pickCanonicalWidgetTextEntry(nodes);
  if (!canonical?.id) return null;

  const duplicates = nodes.filter((n) => n?.id && n.id !== canonical.id);
  if (duplicates.length > 0) {
    console.warn(
      `[metaobject] Removing ${duplicates.length} duplicate widget text entries (${metaobjectType})`,
    );
    for (const duplicate of duplicates) {
      await deleteMetaobjectEntry(admin, duplicate.id);
    }
  }

  return (
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    pickCanonicalWidgetTextEntry(await listWidgetTextEntries(admin, metaobjectType))
  );
}

async function deduplicateWidgetTextEntries(admin, metaobjectType, shopDomain) {
  return withWidgetTextEntryLock(shopDomain, metaobjectType, () =>
    deduplicateWidgetTextEntriesUnlocked(admin, metaobjectType),
  );
}

async function withWidgetTextEntryLock(shopDomain, metaobjectType, fn) {
  const lockKey = `${shopDomain ?? "_"}:${metaobjectType || "type"}`;
  const previous = widgetTextEntryLocks.get(lockKey) || Promise.resolve();

  let release;
  const current = previous.then(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  widgetTextEntryLocks.set(lockKey, current);

  await previous;

  try {
    return await fn();
  } finally {
    release?.();
    if (widgetTextEntryLocks.get(lockKey) === current) {
      widgetTextEntryLocks.delete(lockKey);
    }
  }
}

async function findWidgetTextEntryByList(admin, metaobjectType) {
  const nodes = await listWidgetTextEntries(admin, metaobjectType);
  if (!nodes.length) return null;
  return pickCanonicalWidgetTextEntry(nodes);
}

async function createWidgetTextEntry(admin, metaobjectType, language, values = {}) {
  const fields = await buildUpsertFields(admin, metaobjectType, language, values);
  const fieldInputs = fields.map((f) => ({ key: f.key, value: f.value }));

  const result = await admin.graphql(
    `#graphql
    mutation CreateWidgetTextEntry($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
          type
          fields {
            key
            value
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metaobject: {
          type: metaobjectType,
          handle: WIDGET_TEXT_HANDLE,
          fields: fieldInputs,
        },
      },
    },
  );
  const json = await result.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) throw new Error(gqlError);

  const payload = json?.data?.metaobjectCreate;
  const userError = mutationUserErrors(payload, "metaobjectCreate");
  if (userError) throw new Error(userError);

  return payload?.metaobject || null;
}

async function findWidgetTextEntry(admin) {
  const def = await ensureDefinition(admin);
  if (!def?.id) {
    return { entry: null, metaobjectType: null, definition: null };
  }

  const metaobjectType = def.type || MERCHANT_WIDGET_TEXT_TYPE;

  let entry =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType));

  return {
    entry,
    metaobjectType,
    definition: def,
  };
}

export async function getDefaultWidgetTextMetaobjectId(admin) {
  const { entry } = await findWidgetTextEntry(admin);
  return entry?.id || null;
}

function parseWidgetLanguageField(value) {
  const text = (value || "").toString();
  const match = text.match(/\(([a-z]{2})\)\s*$/i) || text.match(/\(([a-z]{2})\)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Copy legacy per-language entry (e.g. handle "de") into the single default entry. */
async function migrateLegacyLanguageEntry(admin, metaobjectType) {
  const seedLanguage = await getMetaobjectSeedLanguage(admin);
  const legacyHandles = [...new Set([seedLanguage, "en"])];

  for (const legacyHandle of legacyHandles) {
    if (legacyHandle === WIDGET_TEXT_HANDLE) continue;

    try {
      const res = await admin.graphql(
        `#graphql
        query LegacyEntry($handle: MetaobjectHandleInput!) {
          metaobjectByHandle(handle: $handle) {
            fields { key value }
          }
        }`,
        {
          variables: {
            handle: { type: metaobjectType, handle: legacyHandle },
          },
        },
      );
      const { data } = await res.json();
      const fields = data?.metaobjectByHandle?.fields;
      if (fields?.length) {
        const stored = parseMetaobjectFields(fields);
        await upsertPrimaryWidgetText(admin, metaobjectType, seedLanguage, stored);
        return;
      }
    } catch {
      // try next handle
    }
  }
}

async function upsertPrimaryWidgetText(
  admin,
  metaobjectType,
  language,
  values = {},
) {
  const fields = await buildUpsertFields(admin, metaobjectType, language, values);
  const existing =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType));

  if (existing?.id) {
    const updated = await updateWidgetTextEntryById(admin, existing.id, fields);
    if (updated?.id) return updated;
  }

  const result = await admin.graphql(
    `#graphql
    mutation UpsertWidgetText($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
          type
          fields {
            key
            value
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        handle: { type: metaobjectType, handle: WIDGET_TEXT_HANDLE },
        metaobject: { fields },
      },
    },
  );
  const json = await result.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) throw new Error(gqlError);

  const payload = json?.data?.metaobjectUpsert;
  const userError = mutationUserErrors(payload, "metaobjectUpsert");
  if (userError) throw new Error(userError);

  return payload?.metaobject || null;
}

/** Upsert the default entry; create when the store has none (upsert alone can fail on empty stores). */
async function writeDefaultWidgetTextEntry(
  admin,
  metaobjectType,
  seedLanguage,
  values,
) {
  const tryUpsert = () =>
    upsertPrimaryWidgetText(admin, metaobjectType, seedLanguage, values);

  try {
    const upserted = await tryUpsert();
    if (upserted?.id) return upserted;
  } catch (error) {
    console.warn("[metaobject] upsert failed:", error?.message || error);
  }

  const nodes = await listWidgetTextEntries(admin, metaobjectType);
  if (nodes.length === 0) {
    try {
      const created = await createWidgetTextEntry(
        admin,
        metaobjectType,
        seedLanguage,
        values,
      );
      if (created?.id) return created;
    } catch (error) {
      console.warn("[metaobject] create failed:", error?.message || error);
      throw error;
    }
  }

  const upserted = await tryUpsert();
  if (upserted?.id) return upserted;

  return (
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType))
  );
}

async function ensureDefaultWidgetTextEntryUnlocked(
  admin,
  metaobjectType,
  shopDomain,
) {
  await deduplicateWidgetTextEntriesUnlocked(admin, metaobjectType);

  let entry =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType));

  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const values = getDefaultTranslationValues(seedLanguage);

  if (entry?.id && widgetTextEntryIsFullyPopulated(entry)) {
    return entry;
  }

  await migrateLegacyLanguageEntry(admin, metaobjectType);
  await deduplicateWidgetTextEntriesUnlocked(admin, metaobjectType);

  entry =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType));
  if (entry?.id && widgetTextEntryIsFullyPopulated(entry)) {
    return entry;
  }

  entry = await writeDefaultWidgetTextEntry(
    admin,
    metaobjectType,
    seedLanguage,
    values,
  );

  if (!entry?.id) {
    entry =
      (await getWidgetTextMetaobject(admin, metaobjectType)) ||
      (await findWidgetTextEntryByList(admin, metaobjectType));
  }

  await deduplicateWidgetTextEntriesUnlocked(admin, metaobjectType);

  entry =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType)) ||
    entry;

  if (!entry?.id || !widgetTextEntryIsFullyPopulated(entry)) {
    const keysOnEntry = translationFieldKeysOnEntry(entry);
    const missingCount = keysOnEntry.filter((key) => {
      const stored = parseMetaobjectFields(entry?.fields);
      return !stored[key]?.trim();
    }).length;
    throw new Error(
      `Default widget text entry could not be created on ${metaobjectType}.` +
        (missingCount > 0
          ? ` ${missingCount} field(s) still empty on the Default entry.`
          : " Check write_metaobjects scope and re-open Settings."),
    );
  }

  return entry;
}

async function ensureDefaultWidgetTextEntry(admin, metaobjectType, shopDomain) {
  return withWidgetTextEntryLock(shopDomain, metaobjectType, () =>
    ensureDefaultWidgetTextEntryUnlocked(admin, metaobjectType, shopDomain),
  );
}

/**
 * Ensure the single default metaobject entry exists (Translate & Adapt translates this entry).
 */
export async function ensureWidgetTextEntries(admin, shopDomain) {
  if (!admin?.graphql) return [];

  const languages = await fetchShopLanguagesForWidgetEntries(admin);
  const { metaobjectType, definition } = await findWidgetTextEntry(admin);
  if (!definition?.id || !metaobjectType) return languages;

  await ensureDefaultWidgetTextEntry(admin, metaobjectType, shopDomain);
  return languages;
}

async function fetchLocaleTranslationsOnce(admin, metaobjectId, locale) {
  const localeCode = shopLocaleForTranslations(locale);
  if (!metaobjectId || !localeCode) return {};

  try {
    const res = await admin.graphql(
      `#graphql
      query MetaobjectTranslations($id: ID!, $locale: String!) {
        translatableResource(resourceId: $id) {
          translations(locale: $locale) {
            key
            value
          }
        }
      }`,
      { variables: { id: metaobjectId, locale: localeCode } },
    );
    const { data } = await res.json();
    const rows = data?.translatableResource?.translations || [];
    return Object.fromEntries(
      rows.filter((r) => r?.key && r.value).map((r) => [r.key, r.value]),
    );
  } catch {
    return {};
  }
}

async function fetchLocaleTranslations(admin, metaobjectId, locale) {
  let localized = await fetchLocaleTranslationsOnce(admin, metaobjectId, locale);
  if (Object.keys(localized).length > 0) return localized;

  const base = localeToLanguage(locale);
  const full = shopLocaleForTranslations(locale);
  if (base && full && base !== full) {
    localized = await fetchLocaleTranslationsOnce(admin, metaobjectId, base);
  }
  return localized;
}

function normalizeShopLocale(locale) {
  return (locale || "").toString().trim();
}

async function fetchTranslatableDigests(admin, metaobjectId) {
  const digestRes = await admin.graphql(
    `#graphql
    query TranslatableContent($id: ID!) {
      translatableResource(resourceId: $id) {
        translatableContent {
          key
          digest
          locale
        }
      }
    }`,
    { variables: { id: metaobjectId } },
  );
  const digestJson = await digestRes.json();
  const content = digestJson?.data?.translatableResource?.translatableContent || [];
  return Object.fromEntries(
    content.map((c) => [c.key, c.digest]).filter(([k]) => k),
  );
}

async function registerLocaleTranslations(admin, metaobjectId, locale, values) {
  if (!metaobjectId || !locale) return;

  const localeCode = normalizeShopLocale(locale);
  let digestByKey = await fetchTranslatableDigests(admin, metaobjectId);

  const buildInputs = () => {
    const translations = [];
    for (const field of TRANSLATION_FIELDS) {
      const value = values[field.key];
      const digest = digestByKey[field.key];
      if (!digest || value === undefined || value === null) continue;
      translations.push({
        key: field.key,
        value: String(value),
        locale: localeCode,
        translatableContentDigest: digest,
      });
    }
    return translations;
  };

  let translations = buildInputs();

  if (translations.length < TRANSLATION_FIELDS.length) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    digestByKey = await fetchTranslatableDigests(admin, metaobjectId);
    translations = buildInputs();
  }

  if (!translations.length) {
    throw new Error(
      "Could not register translations — metaobject fields may be missing. Run shopify app deploy, then sync again.",
    );
  }

  const result = await admin.graphql(
    `#graphql
    mutation RegisterTranslations($id: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $id, translations: $translations) {
        userErrors { field message }
      }
    }`,
    { variables: { id: metaobjectId, translations } },
  );
  const json = await result.json();
  const errs = json?.data?.translationsRegister?.userErrors;
  if (errs?.length) {
    throw new Error(errs.map((e) => e.message).join(", "));
  }
}

/** Remove secondary-locale translations (e.g. duplicate de rows when de is shop primary). */
async function removeTranslationsForLocale(admin, metaobjectId, locale) {
  if (!metaobjectId || !locale) return;

  const localeCode = shopLocaleForTranslations(locale);
  if (!localeCode) return;

  const keys = TRANSLATION_FIELDS.map((f) => f.key);
  if (!keys.length) return;

  try {
    const result = await admin.graphql(
      `#graphql
      mutation RemoveTranslations($resourceId: ID!, $translationKeys: [String!]!, $locales: [String!]!) {
        translationsRemove(
          resourceId: $resourceId
          translationKeys: $translationKeys
          locales: $locales
        ) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          resourceId: metaobjectId,
          translationKeys: keys,
          locales: [localeCode],
        },
      },
    );
    const json = await result.json();
    const errs = json?.data?.translationsRemove?.userErrors;
    if (errs?.length) {
      console.warn("[metaobject] translationsRemove:", errs.map((e) => e.message).join(", "));
    }
  } catch (error) {
    console.warn("[metaobject] translationsRemove:", error);
  }
}

/**
 * Primary locale content lives on the metaobject fields, not in translationsRegister.
 * Clears mistaken primary-locale translations and writes German (etc.) into base fields.
 */
async function alignPrimaryMetaobjectContent(admin, shopDomain) {
  const { locale: primaryLocaleCode } = await fetchShopPrimaryLocale(
    admin,
    shopDomain,
  );
  const seedLanguage = resolveMetaobjectSeedLanguage(primaryLocaleCode);
  const { entry, metaobjectType } = await findWidgetTextEntry(admin);
  if (!entry?.id || !metaobjectType) return { seedLanguage, locale: primaryLocaleCode };

  const values = getDefaultTranslationValues(seedLanguage);

  await upsertPrimaryWidgetText(admin, metaobjectType, seedLanguage, values);

  const localesToClear = new Set(
    [
      primaryLocaleCode,
      shopLocaleForTranslations(primaryLocaleCode),
      localeToLanguage(primaryLocaleCode),
      seedLanguage,
    ].filter(Boolean),
  );

  for (const loc of localesToClear) {
    await removeTranslationsForLocale(admin, entry.id, loc);
  }

  return { seedLanguage, locale: primaryLocaleCode, values };
}

/** Built-in defaults when metaobject is missing (storefront must stay fast). */
export function fallbackWidgetI18nFromLocale(shopLocale) {
  const localeCode = normalizeShopLocale(shopLocale) || "en";
  const languageKey =
    normalizeLanguage(localeToLanguage(localeCode)) ||
    mapToSupportedLanguage(localeCode);
  return {
    language: languageKey,
    shopLocale: localeCode,
    translationValues: getDefaultTranslationValues(languageKey),
    metaobjectId: null,
    isPrimaryLocale: true,
  };
}

async function findWidgetTextEntryReadOnly(admin) {
  const definition = await resolvePrimaryWidgetTextDefinition(admin);
  if (!definition?.id) {
    return { entry: null, metaobjectType: null, definition: null };
  }

  const metaobjectType = definition.type || MERCHANT_WIDGET_TEXT_TYPE;
  const entry =
    (await getWidgetTextMetaobject(admin, metaobjectType)) ||
    (await findWidgetTextEntryByList(admin, metaobjectType));

  return { entry, metaobjectType, definition };
}

async function resolveWidgetI18nFromEntry(
  admin,
  shopLocale,
  entry,
  metaobjectType,
  shopDomain,
) {
  const { locale: primaryLocaleCode, language: primaryLanguage } =
    await fetchShopPrimaryLocale(admin, shopDomain);
  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const localeCode =
    normalizeShopLocale(shopLocale) || primaryLocaleCode || primaryLanguage;
  const languageKey = mapToSupportedLanguage(localeToLanguage(localeCode));

  const baseStored = parseMetaobjectFields(entry.fields);
  const isPrimary = localesEquivalent(localeCode, primaryLocaleCode);

  const defaultContentLanguage =
    mapToSupportedLanguage(localeToLanguage(primaryLocaleCode)) || seedLanguage;
  const primaryValues = buildTranslationValues(defaultContentLanguage, baseStored);

  let translationValues;
  if (isPrimary) {
    translationValues = primaryValues;
  } else {
    const localized = await fetchLocaleTranslations(admin, entry.id, localeCode);
    translationValues = {};
    for (const field of TRANSLATION_FIELDS) {
      const localizedVal = localized[field.key]?.trim();
      translationValues[field.key] =
        localizedVal || primaryValues[field.key] || "";
    }
  }

  return {
    language: languageKey,
    shopLocale: localeCode,
    translationValues,
    metaobjectId: entry.id,
    isPrimaryLocale: isPrimary,
  };
}

/**
 * Fast path for app proxy / storefront — read-only, no definition create.
 * @param {string} [shopLocale] — e.g. "de", "en" from ?locale= or Shopify.locale
 */
export async function resolveWidgetI18nForStorefront(admin, shopLocale, shopDomain) {
  if (!admin?.graphql) {
    return fallbackWidgetI18nFromLocale(shopLocale);
  }

  if (shopDomain) {
    const cacheKey = `i18n:${shopLocale || "default"}`;
    const cached = getShopCache(shopDomain, cacheKey);
    if (cached) return cached;
  }

  try {
    const { entry, metaobjectType } = await findWidgetTextEntryReadOnly(admin);
    if (!entry?.id || !metaobjectType) {
      return fallbackWidgetI18nFromLocale(shopLocale);
    }
    const resolved = await resolveWidgetI18nFromEntry(
      admin,
      shopLocale,
      entry,
      metaobjectType,
      shopDomain,
    );
    if (shopDomain && resolved) {
      setShopCache(shopDomain, `i18n:${shopLocale || "default"}`, resolved, CACHE_TTL.i18n);
    }
    return resolved;
  } catch (error) {
    console.warn("[metaobject] storefront i18n:", error);
    return fallbackWidgetI18nFromLocale(shopLocale);
  }
}

/**
 * Resolve widget copy for a storefront or admin locale from the Default metaobject.
 * @param {string} [shopLocale] — e.g. "nl", "de", "en" (from Shopify.locale or ?locale=)
 */
export async function resolveWidgetI18n(admin, shopLocale) {
  if (!admin?.graphql) return null;

  const def = await ensureDefinition(admin);
  if (!def) return null;

  await ensureWidgetTextEntries(admin);

  try {
    const { entry, metaobjectType } = await findWidgetTextEntry(admin);
    if (!entry?.id || !metaobjectType) return null;

    return resolveWidgetI18nFromEntry(admin, shopLocale, entry, metaobjectType);
  } catch {
    return null;
  }
}

export async function readWidgetI18nFromMetaobject(admin, languageOrLocale) {
  if (!languageOrLocale) return null;
  return resolveWidgetI18n(admin, languageOrLocale);
}

export async function upsertWidgetI18nMetaobject(admin, { language, translations }) {
  if (!admin?.graphql) return;

  const def = await ensureDefinition(admin);
  if (!def) return;

  const lang = normalizeLanguage(language) || "en";
  const values =
    typeof translations === "object" && translations !== null
      ? translations
      : parseCustomTranslations(translations);

  await ensureWidgetTextEntries(admin);
  const { entry, metaobjectType } = await findWidgetTextEntry(admin);
  if (!entry?.id || !metaobjectType) return;

  const seedLanguage = await getMetaobjectSeedLanguage(admin);

  if (lang === seedLanguage) {
    await upsertPrimaryWidgetText(admin, metaobjectType, lang, values);
  } else {
    await registerLocaleTranslations(admin, entry.id, lang, values);
  }

}

/**
 * @param {object} [options]
 * @param {string} [options.preferredLanguage] — admin UI selection (e.g. from app DB), not stored in metaobjects
 */
export async function loadWidgetI18nSettings(admin, options = {}) {
  const shopDomain = options.shopDomain;
  if (!options.ensureEntries) {
    return loadWidgetI18nSettingsFast(admin, shopDomain, options);
  }

  const provisionedLanguages = await ensureWidgetTextEntries(admin, shopDomain);
  const primaryLanguage = await fetchShopPrimaryLanguage(admin, shopDomain);
  const preferred = normalizeLanguage(options.preferredLanguage);
  const shopLocale = options.shopLocale || preferred || primaryLanguage;

  const i18n = await resolveWidgetI18n(admin, shopLocale);
  const activeLanguage = i18n?.language || primaryLanguage;
  const translationValues =
    i18n?.translationValues || buildTranslationValues(activeLanguage);

  return {
    provisionedLanguages,
    primaryLanguage,
    language: activeLanguage,
    translationValues,
    isPrimaryLocale: i18n?.isPrimaryLocale ?? activeLanguage === primaryLanguage,
  };
}

export function shopDomainToStoreHandle(shopDomain) {
  let normalized = (shopDomain || "").trim().toLowerCase();
  if (!normalized) return "";

  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^admin\.shopify\.com\//, "");
  normalized = normalized.replace(/^store\//, "");
  if (normalized.includes("/")) {
    normalized = normalized.split("/").filter(Boolean)[0] || normalized;
  }
  normalized = normalized.replace(/\.myshopify\.com$/i, "");

  return normalized;
}

export async function fetchShopAdminHandle(admin, shopDomain) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "admin-handle");
    if (cached) return cached;
  }

  if (admin?.graphql) {
    try {
      const res = await admin.graphql(
        `#graphql
        query ShopDomain {
          shop {
            myshopifyDomain
          }
        }`,
      );
      const { data } = await res.json();
      const domain = data?.shop?.myshopifyDomain;
      if (domain) {
        const handle = shopDomainToStoreHandle(domain);
        if (shopDomain) setShopCache(shopDomain, "admin-handle", handle);
        return handle;
      }
    } catch {
      // fall through to session shop domain
    }
  }
  const handle = shopDomainToStoreHandle(shopDomain);
  if (shopDomain) setShopCache(shopDomain, "admin-handle", handle);
  return handle;
}

function buildTranslateAndAdaptUrl(storeHandle, path = "") {
  const handle = shopDomainToStoreHandle(storeHandle);
  if (!handle) return null;
  const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `https://admin.shopify.com/store/${handle}/apps/translate-and-adapt${suffix}`;
}

/** Translate & Adapt app home (unsupported store languages). */
export function translateAndAdaptAppUrl(storeHandle) {
  return buildTranslateAndAdaptUrl(storeHandle) || "";
}

/** Shopify admin — Content → Metaobjects (definitions list). */
export function shopifyContentMetaobjectsUrl(storeHandle) {
  const handle = shopDomainToStoreHandle(storeHandle);
  if (!handle) return null;
  return `https://admin.shopify.com/store/${handle}/content/metaobjects`;
}

/** Shopify admin — Settings → Custom data → Metaobjects. */
export function shopifyMetaobjectsSettingsUrl(storeHandle) {
  const handle = shopDomainToStoreHandle(storeHandle);
  if (!handle) return null;
  return `https://admin.shopify.com/store/${handle}/settings/custom_data/metaobjects`;
}

/** Shopify admin — metaobject entries list for this type. */
export function shopifyMetaobjectEntriesAdminUrl(storeHandle, metaobjectType) {
  const handle = shopDomainToStoreHandle(storeHandle);
  if (!handle || !metaobjectType) {
    return shopifyMetaobjectsSettingsUrl(storeHandle);
  }
  return `https://admin.shopify.com/store/${handle}/content/metaobjects/entries/${encodeURIComponent(metaobjectType)}`;
}

/** Shopify admin — edit a single metaobject entry. */
export function shopifyMetaobjectEntryAdminUrl(
  storeHandle,
  metaobjectType,
  metaobjectGid,
) {
  const handle = shopDomainToStoreHandle(storeHandle);
  const numericId = metaobjectGidToNumericId(metaobjectGid);
  if (!handle || !metaobjectType || !numericId) {
    return shopifyMetaobjectsSettingsUrl(storeHandle);
  }
  return `https://admin.shopify.com/store/${handle}/content/metaobjects/entries/${encodeURIComponent(metaobjectType)}/${numericId}`;
}

/** Translate & Adapt home (pick Metaobjects in the app sidebar). */
export function translateAndAdaptHomeUrl(storeHandle) {
  return buildTranslateAndAdaptUrl(storeHandle) || "";
}

/**
 * Translate & Adapt — metaobject editor for a shop locale.
 * Uses numeric metaobject id (not full GID). $app: types are not listed in T&A.
 */
export function translateAndAdaptMetaobjectUrl(
  storeHandle,
  shopLocale,
  metaobjectGid,
) {
  const base =
    buildTranslateAndAdaptUrl(storeHandle, "/localize/metaobject") || "";
  if (!base) return base;

  const params = new URLSearchParams();
  if (shopLocale) params.set("shopLocale", shopLocale.toString());

  const numericId = metaobjectGidToNumericId(metaobjectGid);
  if (numericId) params.set("id", numericId);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export async function fetchWidgetTextMetaobjectStatus(admin) {
  const def = await ensureDefinition(admin);
  const { entry, metaobjectType } = await findWidgetTextEntry(admin);
  let translatableKeys = 0;

  if (entry?.id) {
    try {
      const res = await admin.graphql(
        `#graphql
        query WidgetTextTranslatable($id: ID!) {
          translatableResource(resourceId: $id) {
            translatableContent {
              key
            }
          }
        }`,
        { variables: { id: entry.id } },
      );
      const json = await res.json();
      translatableKeys =
        json?.data?.translatableResource?.translatableContent?.length || 0;
    } catch {
      translatableKeys = 0;
    }
  }

  const allDefs = await listMetaobjectDefinitions(admin);

  return {
    definitionId: def?.id || null,
    definitionType: metaobjectType || def?.type || null,
    definitionName: TRANSLATABLE_DEFINITION.name,
    definitionCount: allDefs.length,
    hasAppDefinition: allDefs.some(
      (d) => isWidgetTextDefinitionName(d?.name) && isAppOwnedMetaobjectType(d?.type),
    ),
    hasMerchantDefinition: allDefs.some(
      (d) =>
        d?.type === MERCHANT_WIDGET_TEXT_TYPE ||
        (isWidgetTextDefinitionName(d?.name) && !isAppOwnedMetaobjectType(d?.type)),
    ),
    entryId: entry?.id || null,
    entryHandle: entry?.handle || WIDGET_TEXT_HANDLE,
    translatable: Boolean(def?.capabilities?.translatable?.enabled),
    translatableFieldCount: translatableKeys,
    entryCount: metaobjectType
      ? (await listWidgetTextEntries(admin, metaobjectType)).length
      : 0,
  };
}

export async function fetchAllShopLocales(admin, shopDomain) {
  const { rows, error } = await queryShopLocales(admin);

  const labelByCode = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((l) => [l.value, l.label]),
  );

  const locales = rows.map((row) => {
    const appLanguage = normalizeLanguage(localeToLanguage(row.locale));
    return {
      locale: row.locale,
      name: row.name || row.locale,
      primary: Boolean(row.primary),
      published: Boolean(row.published),
      appSupported: Boolean(appLanguage),
      appLanguage,
      appLanguageLabel: appLanguage ? labelByCode[appLanguage] : null,
    };
  });

  locales.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { locales, error };
}

/** Read-only check for Languages page (no definition create / repair). */
export async function getWidgetTextSummary(admin, shopDomain) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "widget-summary");
    if (cached) return cached;
  }

  const { entry, metaobjectType, definition } =
    await findWidgetTextEntryReadOnly(admin);
  const summary = {
    ok: Boolean(definition?.id && widgetTextEntryIsFullyPopulated(entry)),
    error: !definition?.id
      ? "Metaobject definition missing"
      : !entry?.id
        ? "Default entry missing"
        : !widgetTextEntryIsFullyPopulated(entry)
          ? "Default entry is empty"
          : null,
    metaobjectId: entry?.id || null,
    definitionType: metaobjectType || null,
    steps: [],
  };

  if (shopDomain) setShopCache(shopDomain, "widget-summary", summary);
  return summary;
}

/**
 * Fast i18n for admin dashboard / settings (no metaobject provisioning).
 */
export async function loadWidgetI18nSettingsFast(admin, shopDomain, options = {}) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "i18n-settings");
    if (cached) return cached;
  }

  const primaryLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const preferred = normalizeLanguage(options.preferredLanguage);
  const shopLocale = options.shopLocale || preferred || primaryLanguage;
  const i18n = await resolveWidgetI18nForStorefront(admin, shopLocale, shopDomain);
  const activeLanguage = i18n?.language || primaryLanguage;
  const result = {
    provisionedLanguages: [primaryLanguage],
    primaryLanguage,
    language: activeLanguage,
    translationValues:
      i18n?.translationValues || buildTranslationValues(activeLanguage),
    isPrimaryLocale: i18n?.isPrimaryLocale ?? activeLanguage === primaryLanguage,
  };

  if (shopDomain) setShopCache(shopDomain, "i18n-settings", result, CACHE_TTL.i18n);
  return result;
}

export function invalidateWidgetTextShopCache(shopDomain) {
  if (!shopDomain) return;
  invalidateShopCache(shopDomain);
}

/**
 * Ensure metaobject definition + Default entry exist and match store language rules.
 * App-supported primary (e.g. de) → German defaults; otherwise English only.
 */
/** Force-create definition + default entry; returns diagnostics for the Languages UI. */
export async function repairWidgetTextMetaobject(admin, shopDomain, options = {}) {
  const uiLocale = options.uiLocale || "en";
  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const { definition, error, steps } = await ensureDefinitionWithDiagnostics(admin, {
    uiLocale,
  });
  if (!definition?.id) {
    return { ok: false, error, steps, status: null, seedLanguage };
  }

  try {
    const metaobjectType = definition.type || MERCHANT_WIDGET_TEXT_TYPE;
    await migrateAppOwnedEntryToMerchant(admin, shopDomain);
    await ensureDefaultWidgetTextEntry(admin, metaobjectType, shopDomain);
    await alignPrimaryMetaobjectContent(admin, shopDomain);
    const def = await ensureDefinition(admin, { uiLocale });
    if (def?.id) {
      const labels = await loadWidgetDefinitionLabels(uiLocale);
      await ensureDefinitionFieldDefinitions(admin, def.id, metaobjectType, labels);
    }
    const { entry } = await findWidgetTextEntry(admin);
    const status = await fetchWidgetTextMetaobjectStatus(admin);

    if (!entry?.id) {
      return {
        ok: false,
        error:
          "Definition exists but Default entry could not be created. Check write_metaobjects scope.",
        steps,
        status,
      };
    }

    if (shopDomain) invalidateWidgetTextShopCache(shopDomain);

    return {
      ok: true,
      error: null,
      steps: [
        ...steps,
        `Default entry created or updated (store language: ${seedLanguage})`,
      ],
      definitionType: metaobjectType,
      metaobjectId: entry.id,
      seedLanguage,
      status,
    };
  } catch (repairError) {
    return {
      ok: false,
      error: repairError?.message || "Repair failed",
      steps,
      status: await fetchWidgetTextMetaobjectStatus(admin).catch(() => null),
    };
  }
}

export async function provisionWidgetTextMetaobject(admin, options = {}) {
  if (!admin?.graphql) {
    return { ok: false, error: "Admin API unavailable", steps: [] };
  }

  const shopDomain = options.shopDomain;
  const missingScopes = getMissingWidgetTextScopes(options.scope);
  if (missingScopes.length) {
    console.warn("[metaobject] missing scopes:", missingScopes.join(", "));
  }

  if (options.skipIfReady && shopDomain) {
    invalidateShopCache(shopDomain, "widget-summary");
    const summary = await getWidgetTextSummary(admin, shopDomain);
    if (summary.ok) {
      const primaryLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
      const { locale } = await fetchShopPrimaryLocale(admin, shopDomain);
      return {
        ok: true,
        definitionType: summary.definitionType,
        hasEntry: true,
        metaobjectId: summary.metaobjectId,
        language: primaryLanguage,
        locale,
        appSupported: Boolean(normalizeLanguage(primaryLanguage)),
        status: null,
        steps: ["Metaobject already ready"],
      };
    }
  }

  try {
    const repair = await repairWidgetTextMetaobject(admin, shopDomain, {
      uiLocale: options.uiLocale || "en",
    });
    if (!repair.ok) {
      const scopeHint =
        missingScopes.length > 0
          ? ` Missing scopes: ${missingScopes.join(", ")}. Reinstall the app from your dev store list.`
          : "";
      return {
        ok: false,
        error: `${repair.error || "Provisioning failed"}${scopeHint}`,
        steps: repair.steps,
        status: repair.status,
        missingScopes,
      };
    }

    const sync = await syncPrimaryWidgetTextToMetaobject(admin, shopDomain);
    const { entry, metaobjectType } = await findWidgetTextEntry(admin);

    if (shopDomain) invalidateWidgetTextShopCache(shopDomain);

    return {
      ok: true,
      definitionType: metaobjectType || repair.definitionType,
      hasEntry: Boolean(entry?.id),
      metaobjectId: entry?.id || repair.metaobjectId || null,
      language: sync.language,
      locale: sync.locale,
      appSupported: sync.appSupported,
      status: repair.status,
      steps: repair.steps,
    };
  } catch (error) {
    console.error("[metaobject] provision failed:", error);
    return {
      ok: false,
      error: error?.message || "Provisioning failed",
      steps: [],
    };
  }
}

/**
 * Push store-primary defaults onto the Default metaobject entry.
 * App-supported primary (e.g. de) → that language; otherwise English only.
 */
export async function syncPrimaryWidgetTextToMetaobject(admin, shopDomain) {
  await ensureWidgetTextEntries(admin, shopDomain);
  const { metaobjectType } = await findWidgetTextEntry(admin);
  if (!metaobjectType) {
    throw new Error("Widget text metaobject definition is missing");
  }

  const aligned = await alignPrimaryMetaobjectContent(admin, shopDomain);
  if (shopDomain) invalidateWidgetTextShopCache(shopDomain);

  return {
    language: aligned.seedLanguage,
    locale: aligned.locale,
    appSupported: Boolean(normalizeLanguage(localeToLanguage(aligned.locale))),
  };
}

/** App-supported shop locales missing widget text metaobject content. */
export async function fetchUnsyncedWidgetTextLocales(admin, shopDomain) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "unsynced-widget-locales");
    if (cached) return cached;
  }

  const { locales } = await fetchAllShopLocales(admin, shopDomain);
  const unsynced = [];

  await Promise.all(
    locales
      .filter((row) => row.appSupported)
      .map(async (row) => {
        const synced = await isWidgetTextSyncedForShopLocale(
          admin,
          row.locale,
          shopDomain,
        );
        if (!synced) {
          unsynced.push({
            locale: row.locale,
            name: row.name,
            label: row.appLanguageLabel || row.name,
          });
        }
      }),
  );

  unsynced.sort((a, b) => a.name.localeCompare(b.name));

  if (shopDomain) {
    setShopCache(shopDomain, "unsynced-widget-locales", unsynced, CACHE_TTL.i18n);
  }
  return unsynced;
}

/** Whether widget text metaobject content exists for a shop locale (primary fields or translations). */
export async function isWidgetTextSyncedForShopLocale(
  admin,
  shopLocale,
  shopDomain,
) {
  const appLanguage = normalizeLanguage(localeToLanguage(shopLocale));
  if (!appLanguage) return false;

  const { entry } = await findWidgetTextEntryReadOnly(admin);
  if (!entry?.id) return false;

  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const localeCode = normalizeShopLocale(shopLocale);

  if (appLanguage === seedLanguage) {
    return widgetTextEntryIsFullyPopulated(entry);
  }

  const localized = await fetchLocaleTranslations(admin, entry.id, localeCode);
  return TRANSLATION_FIELDS.every((field) =>
    Boolean(localized[field.key]?.trim()),
  );
}

/**
 * Seed widget text for a shop locale (full built-in defaults for that language).
 * @returns {{ supported: true, language: string }} | {{ supported: false }}
 */
export async function syncWidgetTextForShopLocale(admin, shopLocale, shopDomain) {
  const appLanguage = normalizeLanguage(localeToLanguage(shopLocale));
  if (!appLanguage) {
    return { supported: false };
  }

  await repairWidgetTextMetaobject(admin, shopDomain, { uiLocale: appLanguage });
  await ensureWidgetTextEntries(admin, shopDomain);

  let { entry, metaobjectType, definition } = await findWidgetTextEntry(admin);
  if (!entry?.id || !metaobjectType) {
    throw new Error("Widget text metaobject entry is missing");
  }

  if (definition?.id) {
    const labels = await loadWidgetDefinitionLabels(appLanguage);
    await ensureDefinitionFieldDefinitions(
      admin,
      definition.id,
      metaobjectType,
      labels,
    );
  }

  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);
  const values = getDefaultTranslationValues(appLanguage);
  const localeCode = normalizeShopLocale(shopLocale);

  if (appLanguage === seedLanguage) {
    await upsertPrimaryWidgetText(admin, metaobjectType, appLanguage, values);
    if (!isAppOwnedMetaobjectType(metaobjectType)) {
      await alignPrimaryMetaobjectContent(admin, shopDomain);
    }
  } else {
    ({ entry } = await findWidgetTextEntry(admin));
    if (!entry?.id) {
      throw new Error("Widget text metaobject entry is missing");
    }
    await registerLocaleTranslations(admin, entry.id, localeCode, values);
  }

  if (shopDomain) invalidateWidgetTextShopCache(shopDomain);

  return { supported: true, language: appLanguage, locale: localeCode };
}

/**
 * Ensure merchant metaobject definition, field schema, and default entry content exist.
 * Writes built-in defaults into base fields for the store primary language.
 */
export async function ensureWidgetTextContentPopulated(admin, shopDomain) {
  const repair = await repairWidgetTextMetaobject(admin, shopDomain, {
    uiLocale: "en",
  });
  if (!repair.ok) {
    throw new Error(repair.error || "Could not provision widget text metaobject");
  }

  let { entry, metaobjectType, definition } = await findWidgetTextEntry(admin);
  const seedLanguage = await getMetaobjectSeedLanguage(admin, shopDomain);

  const needsRepair =
    !widgetTextEntryIsFullyPopulated(entry) || widgetTextEntryNeedsBackfill(entry);

  if (needsRepair) {
    const def = definition || (await ensureDefinition(admin, { uiLocale: "en" }));
    if (def?.id && metaobjectType) {
      const labels = await loadWidgetDefinitionLabels("en");
      await ensureDefinitionFieldDefinitions(admin, def.id, metaobjectType, labels);
      await ensureWidgetDefinitionName(admin, def, labels);
    }

    const stored = parseMetaobjectFields(entry?.fields);
    const merged = buildTranslationValues(seedLanguage, stored);
    await upsertPrimaryWidgetText(admin, metaobjectType, seedLanguage, merged);
    if (!isAppOwnedMetaobjectType(metaobjectType)) {
      await alignPrimaryMetaobjectContent(admin, shopDomain);
    }

    ({ entry, metaobjectType, definition } = await findWidgetTextEntry(admin));
  }

  if (shopDomain) invalidateWidgetTextShopCache(shopDomain);

  return {
    ok: widgetTextEntryIsFullyPopulated(entry),
    metaobjectId: entry?.id || null,
    definitionType: metaobjectType || definition?.type || APP_METAOBJECT_TYPE,
    definitionName: WIDGET_TEXT_DEFINITION_NAME,
  };
}

export function translationValuesToOverrides(translationValues) {
  if (!translationValues || typeof translationValues !== "object") return null;
  const trimmed = {};
  for (const field of TRANSLATION_FIELDS) {
    const val = translationValues[field.key];
    if (val !== undefined && val !== null && String(val).trim()) {
      trimmed[field.key] = String(val).trim();
    }
  }
  return Object.keys(trimmed).length > 0 ? JSON.stringify(trimmed) : null;
}
