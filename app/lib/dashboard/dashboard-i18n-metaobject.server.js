import {
  CACHE_TTL,
  getShopCache,
  invalidateShopCache,
  setShopCache,
} from "../shop-cache.server.js";
import {
  DASHBOARD_SECTIONS,
  buildDashboardMessagesFromSections,
  getDefaultDashboardSectionValuesForLanguage,
  loadBundledDashboardMessages,
  loadDashboardDefinitionLabels,
} from "./dashboard-i18n-messages.server.js";
import {
  fetchAllShopLocales,
  fetchShopAdminHandle,
  localeToLanguage,
  normalizeLanguage,
  translateAndAdaptMetaobjectUrl,
} from "../widget/booking-widget-i18n-metaobject.server.js";
import {
  parseDashboardSeedLanguageFromFieldValue,
  resolveDashboardSeedLanguage,
} from "../admin-i18n.shared.js";

export const MERCHANT_DASHBOARD_TEXT_TYPE = "ab_dashboard_text";
const APP_DASHBOARD_TEXT_TYPE = "$app:dashboard_text";
const DASHBOARD_TEXT_HANDLE = "default";
const LANGUAGE_FIELD_KEY = "language";
const DISPLAY_NAME_FIELD_KEY = "language";
const DASHBOARD_DEFINITION_NAME = "Dashboard Text";

const LANGUAGE_FIELD_DESCRIPTION =
  "Display name for this entry (set automatically from your Admin language).";

function formatDashboardLanguageFieldValue(language, languageNames = {}) {
  const code = normalizeLanguage(language) || "en";
  const label =
    languageNames[code] ||
    LANGUAGE_LABEL_BY_CODE[code] ||
    code.toUpperCase();
  return `${label} (${code})`;
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

const LANGUAGE_LABEL_BY_CODE = {
  en: "English",
  es: "Spanish",
  de: "German",
  fr: "French",
};

function isAppOwnedMetaobjectType(type) {
  const value = (type || "").toString();
  return value.startsWith("$app:") || value.includes("app--");
}

function normalizeShopLocale(locale) {
  return (locale || "").toString().trim();
}

function shopLocaleForTranslations(locale) {
  const code = normalizeShopLocale(locale);
  if (!code) return null;
  return code.replace(/_/g, "-");
}

function parseMetaobjectFieldMap(fields) {
  return Object.fromEntries((fields || []).map((field) => [field.key, field.value]));
}

function dashboardSeedLanguageFromEntry(entry, uiLocale = "en") {
  const map = parseMetaobjectFieldMap(entry?.fields);
  return (
    parseDashboardSeedLanguageFromFieldValue(map[LANGUAGE_FIELD_KEY]) ||
    resolveDashboardSeedLanguage(uiLocale)
  );
}

function dashboardEntryIsPopulated(entry) {
  if (!entry?.fields?.length) return false;
  const map = parseMetaobjectFieldMap(entry.fields);
  return DASHBOARD_SECTIONS.some((section) => Boolean(map[section.key]?.trim()));
}

async function queryDefinitionByType(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query DashboardTextDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          type
          name
          displayNameKey
          capabilities {
            translatable { enabled }
          }
        }
      }`,
      { variables: { type: metaobjectType } },
    );
    const { data } = await res.json();
    return data?.metaobjectDefinitionByType || null;
  } catch {
    return null;
  }
}

async function listMetaobjectDefinitions(admin) {
  try {
    const res = await admin.graphql(
      `#graphql
      query DashboardDefinitionScan {
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
  } catch {
    return [];
  }
}

function isDashboardTextDefinitionName(name) {
  const value = (name || "").toString().toLowerCase();
  return (
    value.includes("dashboard text") ||
    value.includes("texto del panel") ||
    value.includes("texte du tableau de bord") ||
    value.includes("dashboard-text") ||
    value.includes("appointment booking dashboard") ||
    value.includes("ab dashboard")
  );
}

async function findDashboardTextDefinitionByScan(admin) {
  const nodes = await listMetaobjectDefinitions(admin);
  const merchant = nodes.find(
    (node) =>
      isDashboardTextDefinitionName(node?.name) &&
      node?.type &&
      !isAppOwnedMetaobjectType(node.type),
  );
  if (merchant?.id) return merchant;

  return nodes.find((node) => node?.type === MERCHANT_DASHBOARD_TEXT_TYPE) || null;
}

async function ensureDashboardDefinitionFields(admin, definition, labels) {
  if (!definition?.id || isAppOwnedMetaobjectType(definition.type) || !labels) {
    return;
  }

  try {
    const metaobjectType = definition.type || MERCHANT_DASHBOARD_TEXT_TYPE;
    const existingFields =
      await queryDashboardDefinitionFieldDefinitions(admin, metaobjectType);
    const keys = existingFields.map((f) => f.key);
    const byKey = Object.fromEntries(existingFields.map((f) => [f.key, f]));
    const fieldOps = [];

    const languageName = labels.languageFieldName;
    const languageDescription = labels.languageFieldDescription;
    if (!keys.includes(LANGUAGE_FIELD_KEY)) {
      fieldOps.push({
        create: {
          key: LANGUAGE_FIELD_KEY,
          name: languageName,
          description: languageDescription,
          type: "single_line_text_field",
        },
      });
    } else if (
      byKey[LANGUAGE_FIELD_KEY]?.name !== languageName ||
      byKey[LANGUAGE_FIELD_KEY]?.description !== languageDescription
    ) {
      fieldOps.push({
        update: {
          key: LANGUAGE_FIELD_KEY,
          name: languageName,
          description: languageDescription,
        },
      });
    }

    for (const section of labels.sections) {
      if (!keys.includes(section.key)) {
        fieldOps.push({
          create: {
            key: section.key,
            name: section.name,
            description: section.description,
            type: "multi_line_text_field",
          },
        });
      } else if (
        byKey[section.key]?.name !== section.name ||
        byKey[section.key]?.description !== section.description
      ) {
        fieldOps.push({
          update: {
            key: section.key,
            name: section.name,
            description: section.description,
          },
        });
      }
    }

    if (fieldOps.length === 0) return;

    await admin.graphql(
      `#graphql
      mutation UpdateDashboardTextDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: definition.id,
          definition: {
            displayNameKey: DISPLAY_NAME_FIELD_KEY,
            fieldDefinitions: fieldOps,
          },
        },
      },
    );
  } catch (error) {
    console.warn("[dashboard-metaobject] definition fields:", error);
  }
}

async function ensureDashboardDefinitionName(admin, definition, labels) {
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
      mutation UpdateDashboardDefinitionName($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
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
    console.warn("[dashboard-metaobject] definition name:", error);
  }
}

async function createMerchantDashboardTextDefinition(admin, labels) {
  const fieldDefinitions = [
    {
      key: LANGUAGE_FIELD_KEY,
      name: labels.languageFieldName,
      description: labels.languageFieldDescription,
      type: "single_line_text_field",
    },
    ...labels.sections.map((section) => ({
      key: section.key,
      name: section.name,
      description: section.description,
      type: "multi_line_text_field",
    })),
  ];

  const result = await admin.graphql(
    `#graphql
    mutation CreateDashboardTextDefinition($definition: MetaobjectDefinitionCreateInput!) {
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
    {
      variables: {
        definition: {
          name: labels.definitionName || DASHBOARD_DEFINITION_NAME,
          type: MERCHANT_DASHBOARD_TEXT_TYPE,
          displayNameKey: DISPLAY_NAME_FIELD_KEY,
          access: { storefront: "PUBLIC_READ" },
          capabilities: { translatable: { enabled: true } },
          fieldDefinitions,
        },
      },
    },
  );
  const json = await result.json();
  const gqlError = graphqlResponseErrors(json);
  if (gqlError) throw new Error(gqlError);

  const payload = json?.data?.metaobjectDefinitionCreate;
  const userError = mutationUserErrors(payload, "metaobjectDefinitionCreate");
  if (userError) throw new Error(userError);

  return payload?.metaobjectDefinition || null;
}

async function enableTranslatableOnDefinition(admin, definition) {
  if (!definition?.id || definition?.capabilities?.translatable?.enabled) return;

  await admin.graphql(
    `#graphql
    mutation EnableDashboardTranslatable($id: ID!) {
      metaobjectDefinitionUpdate(
        id: $id
        definition: { capabilities: { translatable: { enabled: true } } }
      ) {
        userErrors { field message }
      }
    }`,
    { variables: { id: definition.id } },
  );
}

async function ensureDashboardDefinition(admin, options = {}) {
  const uiLocale = options.uiLocale || "en";
  const labels = await loadDashboardDefinitionLabels(uiLocale);

  let definition =
    (await queryDefinitionByType(admin, MERCHANT_DASHBOARD_TEXT_TYPE)) ||
    (await findDashboardTextDefinitionByScan(admin)) ||
    (await queryDefinitionByType(admin, APP_DASHBOARD_TEXT_TYPE));

  if (!definition?.id) {
    definition = await createMerchantDashboardTextDefinition(admin, labels);
  }

  if (!definition?.id) {
    throw new Error("Dashboard text metaobject definition is missing");
  }

  if (!isAppOwnedMetaobjectType(definition.type)) {
    await enableTranslatableOnDefinition(admin, definition);
    await ensureDashboardDefinitionName(admin, definition, labels);
    await ensureDashboardDefinitionFields(admin, definition, labels);
  }

  return definition;
}

/** Sync metaobject admin field labels to the staff Admin UI language. */
export async function syncDashboardDefinitionLabels(
  admin,
  uiLocale = "en",
  shopDomain,
) {
  const definition = await ensureDashboardDefinition(admin, { uiLocale });

  if (shopDomain && definition?.type && !isAppOwnedMetaobjectType(definition.type)) {
    try {
      const entry =
        (await getDashboardTextMetaobject(admin, definition.type)) ||
        (await listDashboardTextEntries(admin, definition.type)).find(
          (node) => node?.handle === DASHBOARD_TEXT_HANDLE,
        );
      if (entry?.id) {
        const seedLanguage = dashboardSeedLanguageFromEntry(entry, uiLocale);
        const labels = await loadDashboardDefinitionLabels(uiLocale);
        const languageValue = formatDashboardLanguageFieldValue(
          seedLanguage,
          labels.languageNames,
        );
        const currentMap = parseMetaobjectFieldMap(entry.fields);
        if (currentMap[LANGUAGE_FIELD_KEY] !== languageValue) {
          await admin.graphql(
            `#graphql
            mutation UpdateDashboardLanguageLabel($id: ID!, $metaobject: MetaobjectUpdateInput!) {
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
      }
    } catch (error) {
      console.warn("[dashboard-metaobject] language display field:", error);
    }
  }

  return definition;
}

async function queryDashboardDefinitionFieldDefinitions(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query DashboardDefinitionFields($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          fieldDefinitions {
            key
            name
            description
          }
        }
      }`,
      { variables: { type: metaobjectType } },
    );
    const json = await res.json();
    return json?.data?.metaobjectDefinitionByType?.fieldDefinitions || [];
  } catch {
    return [];
  }
}

async function getDashboardTextMetaobject(admin, metaobjectType) {
  const res = await admin.graphql(
    `#graphql
    query DashboardTextMetaobject($handle: MetaobjectHandleInput!) {
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
        handle: { type: metaobjectType, handle: DASHBOARD_TEXT_HANDLE },
      },
    },
  );
  const json = await res.json();
  return json?.data?.metaobjectByHandle || null;
}

async function listDashboardTextEntries(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query DashboardTextEntries($type: String!) {
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

async function findDashboardTextEntryReadOnly(admin) {
  const definition =
    (await queryDefinitionByType(admin, MERCHANT_DASHBOARD_TEXT_TYPE)) ||
    (await findDashboardTextDefinitionByScan(admin)) ||
    (await queryDefinitionByType(admin, APP_DASHBOARD_TEXT_TYPE));

  if (!definition?.type) {
    return { entry: null, metaobjectType: null, definition: null };
  }

  const metaobjectType = definition.type;
  const entry =
    (await getDashboardTextMetaobject(admin, metaobjectType)) ||
    (await listDashboardTextEntries(admin, metaobjectType)).find(
      (node) => node?.handle === DASHBOARD_TEXT_HANDLE,
    ) ||
    null;

  return { entry, metaobjectType, definition };
}

async function findDashboardTextEntry(admin) {
  const definition = await ensureDashboardDefinition(admin);
  const metaobjectType = definition.type || MERCHANT_DASHBOARD_TEXT_TYPE;
  let entry =
    (await getDashboardTextMetaobject(admin, metaobjectType)) ||
    (await listDashboardTextEntries(admin, metaobjectType)).find(
      (node) => node?.handle === DASHBOARD_TEXT_HANDLE,
    ) ||
    null;

  return { entry, metaobjectType, definition };
}

function buildUpsertFields(language, values = {}, languageNames = {}) {
  const lang = normalizeLanguage(language) || "en";
  const fields = DASHBOARD_SECTIONS.map((section) => ({
    key: section.key,
    value: values[section.key] || "",
  }));

  return [
    {
      key: LANGUAGE_FIELD_KEY,
      value: formatDashboardLanguageFieldValue(lang, languageNames),
    },
    ...fields,
  ];
}

async function upsertPrimaryDashboardText(
  admin,
  metaobjectType,
  language,
  values,
  languageNames = {},
) {
  const result = await admin.graphql(
    `#graphql
    mutation UpsertDashboardText($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
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
        handle: { type: metaobjectType, handle: DASHBOARD_TEXT_HANDLE },
        metaobject: { fields: buildUpsertFields(language, values, languageNames) },
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

async function createDashboardTextEntry(
  admin,
  metaobjectType,
  language,
  values,
  languageNames = {},
) {
  const result = await admin.graphql(
    `#graphql
    mutation CreateDashboardText($metaobject: MetaobjectCreateInput!) {
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
          handle: DASHBOARD_TEXT_HANDLE,
          fields: buildUpsertFields(language, values, languageNames),
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

async function ensureDefaultDashboardTextEntry(
  admin,
  metaobjectType,
  shopDomain,
  uiLocale = "en",
) {
  let entry =
    (await getDashboardTextMetaobject(admin, metaobjectType)) ||
    (await listDashboardTextEntries(admin, metaobjectType)).find(
      (node) => node?.handle === DASHBOARD_TEXT_HANDLE,
    ) ||
    null;

  if (entry?.id && dashboardEntryIsPopulated(entry)) {
    return entry;
  }

  const seedLanguage = resolveDashboardSeedLanguage(uiLocale);
  const values = await getDefaultDashboardSectionValuesForLanguage(seedLanguage);
  const labels = await loadDashboardDefinitionLabels(uiLocale);
  const languageNames = labels.languageNames || {};

  try {
    entry = await upsertPrimaryDashboardText(
      admin,
      metaobjectType,
      seedLanguage,
      values,
      languageNames,
    );
  } catch (error) {
    console.warn("[dashboard-metaobject] upsert failed:", error?.message || error);
  }

  if (!entry?.id) {
    const nodes = await listDashboardTextEntries(admin, metaobjectType);
    if (nodes.length === 0) {
      entry = await createDashboardTextEntry(
        admin,
        metaobjectType,
        seedLanguage,
        values,
        languageNames,
      );
    } else {
      entry = await upsertPrimaryDashboardText(
        admin,
        metaobjectType,
        seedLanguage,
        values,
        languageNames,
      );
    }
  }

  if (!entry?.id || !dashboardEntryIsPopulated(entry)) {
    throw new Error(
      "Default dashboard text entry could not be created or populated.",
    );
  }

  return entry;
}

async function fetchLocaleTranslationsOnce(admin, metaobjectId, locale) {
  const localeCode = shopLocaleForTranslations(locale);
  if (!metaobjectId || !localeCode) return {};

  try {
    const res = await admin.graphql(
      `#graphql
      query DashboardTranslations($id: ID!, $locale: String!) {
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
      rows.filter((row) => row?.key && row.value).map((row) => [row.key, row.value]),
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

async function registerLocaleTranslations(admin, metaobjectId, locale, values) {
  if (!metaobjectId || !locale) return;

  const localeCode = normalizeShopLocale(locale);
  const digestRes = await admin.graphql(
    `#graphql
    query DashboardTranslatableContent($id: ID!) {
      translatableResource(resourceId: $id) {
        translatableContent {
          key
          digest
        }
      }
    }`,
    { variables: { id: metaobjectId } },
  );
  const digestJson = await digestRes.json();
  const content = digestJson?.data?.translatableResource?.translatableContent || [];
  const digestByKey = Object.fromEntries(
    content.map((item) => [item.key, item.digest]).filter(([key]) => key),
  );

  const translations = [];
  const keys = [LANGUAGE_FIELD_KEY, ...DASHBOARD_SECTIONS.map((section) => section.key)];
  for (const key of keys) {
    const value = values[key];
    const digest = digestByKey[key];
    if (!digest || value === undefined || value === null) continue;
    translations.push({
      key,
      value: String(value),
      locale: localeCode,
      translatableContentDigest: digest,
    });
  }

  if (!translations.length) return;

  const result = await admin.graphql(
    `#graphql
    mutation RegisterDashboardTranslations($id: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $id, translations: $translations) {
        userErrors { field message }
      }
    }`,
    { variables: { id: metaobjectId, translations } },
  );
  const json = await result.json();
  const errs = json?.data?.translationsRegister?.userErrors;
  if (errs?.length) {
    throw new Error(errs.map((error) => error.message).join(", "));
  }
}

export function invalidateDashboardTextShopCache(shopDomain) {
  if (!shopDomain) return;
  invalidateShopCache(shopDomain, "dashboard-summary");
  invalidateShopCache(shopDomain, "unsynced-dashboard-locales");
}

export async function getDashboardTextSummary(admin, shopDomain) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "dashboard-summary");
    if (cached) return cached;
  }

  const { entry, metaobjectType, definition } =
    await findDashboardTextEntryReadOnly(admin);
  const summary = {
    ok: Boolean(definition?.id && dashboardEntryIsPopulated(entry)),
    error: !definition?.id
      ? "Dashboard metaobject definition missing"
      : !entry?.id
        ? "Dashboard default entry missing"
        : !dashboardEntryIsPopulated(entry)
          ? "Dashboard default entry is empty"
          : null,
    metaobjectId: entry?.id || null,
    definitionType: metaobjectType || null,
    steps: [],
  };

  if (shopDomain) setShopCache(shopDomain, "dashboard-summary", summary);
  return summary;
}

export async function provisionDashboardTextMetaobject(admin, options = {}) {
  if (!admin?.graphql) {
    return { ok: false, error: "Admin API unavailable", steps: [] };
  }

  const shopDomain = options.shopDomain;

  if (options.skipIfReady && shopDomain) {
    invalidateDashboardTextShopCache(shopDomain);
    const summary = await getDashboardTextSummary(admin, shopDomain);
    if (summary.ok) {
      return {
        ok: true,
        metaobjectId: summary.metaobjectId,
        steps: ["Dashboard metaobject already ready"],
      };
    }
  }

  try {
    const definition = await ensureDashboardDefinition(admin, {
      uiLocale: options.uiLocale || "en",
    });
    const metaobjectType = definition.type || MERCHANT_DASHBOARD_TEXT_TYPE;
    const entry = await ensureDefaultDashboardTextEntry(
      admin,
      metaobjectType,
      shopDomain,
      options.uiLocale || "en",
    );

    if (shopDomain) invalidateDashboardTextShopCache(shopDomain);

    return {
      ok: true,
      metaobjectId: entry?.id || null,
      definitionType: metaobjectType,
      steps: ["Dashboard metaobject provisioned"],
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Dashboard provisioning failed",
      steps: [],
    };
  }
}

export async function loadDashboardMessagesFromMetaobject(
  admin,
  locale,
  shopDomain,
) {
  if (!admin?.graphql) return null;

  const { entry } = await findDashboardTextEntryReadOnly(admin);
  if (!entry?.id || !dashboardEntryIsPopulated(entry)) {
    return null;
  }

  const primaryMap = parseMetaobjectFieldMap(entry.fields);
  const primarySections = Object.fromEntries(
    DASHBOARD_SECTIONS.map((section) => [section.key, primaryMap[section.key] || ""]),
  );

  const seedLanguage = dashboardSeedLanguageFromEntry(entry, locale);
  const appLanguage = resolveDashboardSeedLanguage(locale);
  const fallbackMessages = await loadBundledDashboardMessages(appLanguage);

  let sectionValues = primarySections;

  if (appLanguage !== seedLanguage) {
    const localized = await fetchLocaleTranslations(admin, entry.id, locale);
    sectionValues = {};
    for (const section of DASHBOARD_SECTIONS) {
      if (localized[section.key]?.trim()) {
        sectionValues[section.key] = localized[section.key];
        continue;
      }

      const bundledSection = fallbackMessages[section.key];
      sectionValues[section.key] =
        bundledSection && typeof bundledSection === "object"
          ? JSON.stringify(bundledSection, null, 2)
          : primarySections[section.key] || "{}";
    }
  }

  return buildDashboardMessagesFromSections(
    sectionValues,
    fallbackMessages,
  );
}

export async function isDashboardTextSyncedForShopLocale(
  admin,
  shopLocale,
  shopDomain,
) {
  const appLanguage = normalizeLanguage(localeToLanguage(shopLocale));
  if (!appLanguage) return false;

  const { entry } = await findDashboardTextEntryReadOnly(admin);
  if (!entry?.id) return false;

  const seedLanguage = dashboardSeedLanguageFromEntry(entry);
  if (appLanguage === seedLanguage) {
    return dashboardEntryIsPopulated(entry);
  }

  const localized = await fetchLocaleTranslations(
    admin,
    entry.id,
    normalizeShopLocale(shopLocale),
  );
  return DASHBOARD_SECTIONS.some((section) =>
    Boolean(localized[section.key]?.trim()),
  );
}

export async function syncDashboardTextForShopLocale(
  admin,
  shopLocale,
  shopDomain,
  uiLocale = "en",
) {
  const appLanguage = normalizeLanguage(localeToLanguage(shopLocale));
  if (!appLanguage) {
    return { supported: false };
  }

  const definition = await ensureDashboardDefinition(admin, { uiLocale });
  const metaobjectType = definition.type || MERCHANT_DASHBOARD_TEXT_TYPE;
  const entry = await ensureDefaultDashboardTextEntry(
    admin,
    metaobjectType,
    shopDomain,
    uiLocale,
  );
  if (!entry?.id) {
    throw new Error("Dashboard text metaobject entry is missing");
  }

  const seedLanguage = dashboardSeedLanguageFromEntry(entry, uiLocale);
  const values = await getDefaultDashboardSectionValuesForLanguage(appLanguage);
  const localeCode = normalizeShopLocale(shopLocale);

  if (appLanguage === seedLanguage) {
    await upsertPrimaryDashboardText(admin, metaobjectType, appLanguage, values);
  } else {
    values[LANGUAGE_FIELD_KEY] = formatDashboardLanguageFieldValue(appLanguage);
    await registerLocaleTranslations(admin, entry.id, localeCode, values);
  }

  if (shopDomain) invalidateDashboardTextShopCache(shopDomain);

  return { supported: true, language: appLanguage, locale: localeCode };
}

export async function resetDashboardTextDefaults(admin, shopDomain, uiLocale = "en") {
  const seedLanguage = resolveDashboardSeedLanguage(uiLocale);
  const definition = await ensureDashboardDefinition(admin, { uiLocale });
  const metaobjectType = definition.type || MERCHANT_DASHBOARD_TEXT_TYPE;
  const labels = await loadDashboardDefinitionLabels(uiLocale);
  const values = await getDefaultDashboardSectionValuesForLanguage(seedLanguage);

  await upsertPrimaryDashboardText(
    admin,
    metaobjectType,
    seedLanguage,
    values,
    labels.languageNames || {},
  );

  if (shopDomain) invalidateDashboardTextShopCache(shopDomain);

  return {
    supported: true,
    locale: seedLanguage,
    language: seedLanguage,
  };
}

export async function fetchUnsyncedDashboardTextLocales(admin, shopDomain) {
  if (shopDomain) {
    const cached = getShopCache(shopDomain, "unsynced-dashboard-locales");
    if (cached) return cached;
  }

  const { locales } = await fetchAllShopLocales(admin, shopDomain);
  const unsynced = [];

  await Promise.all(
    locales
      .filter((row) => row.appSupported)
      .map(async (row) => {
        const synced = await isDashboardTextSyncedForShopLocale(
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
    setShopCache(
      shopDomain,
      "unsynced-dashboard-locales",
      unsynced,
      CACHE_TTL.i18n,
    );
  }

  return unsynced;
}

export function translateAndAdaptDashboardMetaobjectUrl(
  storeHandle,
  shopLocale,
  metaobjectGid,
) {
  return translateAndAdaptMetaobjectUrl(storeHandle, shopLocale, metaobjectGid);
}

export { fetchShopAdminHandle };
