import {
  fetchShopPrimaryLocale,
  getMetaobjectSeedLanguage,
  localeToLanguage,
  normalizeLanguage,
  translateAndAdaptMetaobjectUrl,
} from "./booking-widget-i18n-metaobject.server.js";

function normalizeShopLocale(locale) {
  return (locale || "").toString().trim();
}

function localesEquivalent(a, b) {
  const na = normalizeShopLocale(a)?.toLowerCase().replace(/_/g, "-");
  const nb = normalizeShopLocale(b)?.toLowerCase().replace(/_/g, "-");
  if (!na || !nb) return na === nb;
  if (na === nb) return true;
  return na.split("-")[0] === nb.split("-")[0];
}

export const MERCHANT_SERVICE_TEXT_TYPE = "ab_booking_service_text";
export const APP_SERVICE_TEXT_TYPE = "$app:booking_service_text";
export const MERCHANT_MEETING_TYPE_TEXT_TYPE = "ab_booking_meeting_type_text";
export const APP_MEETING_TYPE_TEXT_TYPE = "$app:booking_meeting_type_text";

export const SERVICE_TEXT_FIELDS = [
  { key: "name", label: "Service name" },
  { key: "description", label: "Description" },
];

export const MEETING_TYPE_TEXT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "subtitle", label: "Subtitle" },
  { key: "description", label: "Description" },
];

const CATALOG_KINDS = {
  service: {
    merchantType: MERCHANT_SERVICE_TEXT_TYPE,
    appType: APP_SERVICE_TEXT_TYPE,
    definitionName: "Book appointment service text",
    fields: SERVICE_TEXT_FIELDS,
    requiredKeys: ["name"],
  },
  meetingType: {
    merchantType: MERCHANT_MEETING_TYPE_TEXT_TYPE,
    appType: APP_MEETING_TYPE_TEXT_TYPE,
    definitionName: "Book appointment meeting type text",
    fields: MEETING_TYPE_TEXT_FIELDS,
    requiredKeys: ["name"],
  },
};

function graphqlResponseErrors(json) {
  if (!json?.errors?.length) return "";
  return json.errors.map((e) => e.message).join("; ");
}

function mutationUserErrors(payload, operation) {
  const errors = payload?.userErrors?.filter((e) => e.message);
  if (!errors?.length) return null;
  return `${operation}: ${errors.map((e) => e.message).join(", ")}`;
}

function parseMetaobjectFieldMap(fields) {
  return Object.fromEntries((fields || []).map((field) => [field.key, field.value]));
}

function catalogHandle(entityId) {
  return (entityId || "").toString().trim();
}

async function queryDefinitionByType(admin, metaobjectType) {
  try {
    const res = await admin.graphql(
      `#graphql
      query CatalogTextDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          type
          name
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
      query CatalogDefinitionScan {
        metaobjectDefinitions(first: 50) {
          nodes {
            id
            type
            name
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

async function resolveCatalogDefinition(admin, kind) {
  const config = CATALOG_KINDS[kind];
  if (!config) return null;

  const deployedApp = await queryDefinitionByType(admin, config.appType);
  if (deployedApp?.id) return deployedApp;

  const merchant = await queryDefinitionByType(admin, config.merchantType);
  if (merchant?.id) return merchant;

  const nodes = await listMetaobjectDefinitions(admin);
  return (
    nodes.find(
      (node) =>
        (node?.name || "").toLowerCase() === config.definitionName.toLowerCase(),
    ) || null
  );
}

async function createCatalogDefinition(admin, kind) {
  const config = CATALOG_KINDS[kind];
  const result = await admin.graphql(
    `#graphql
    mutation CreateCatalogTextDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          type
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
          name: config.definitionName,
          type: config.merchantType,
          displayNameKey: "name",
          access: { storefront: "PUBLIC_READ" },
          capabilities: { translatable: { enabled: true } },
          fieldDefinitions: config.fields.map((field) => ({
            key: field.key,
            name: field.label,
            type: "single_line_text_field",
          })),
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

async function ensureCatalogDefinition(admin, kind) {
  let definition = await resolveCatalogDefinition(admin, kind);
  if (!definition?.id) {
    definition = await createCatalogDefinition(admin, kind);
  }
  if (!definition?.id) {
    throw new Error(`Catalog metaobject definition missing for ${kind}`);
  }
  return definition;
}

async function getCatalogEntryByHandle(admin, metaobjectType, entityId) {
  const handle = catalogHandle(entityId);
  if (!handle || !metaobjectType) return null;

  try {
    const res = await admin.graphql(
      `#graphql
      query CatalogEntryByHandle($handle: MetaobjectHandleInput!) {
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
          handle: { type: metaobjectType, handle },
        },
      },
    );
    const json = await res.json();
    return json?.data?.metaobjectByHandle || null;
  } catch {
    return null;
  }
}

function buildCatalogFieldInputs(fields, values = {}) {
  return fields.map((field) => ({
    key: field.key,
    value: values[field.key] != null ? String(values[field.key]) : "",
  }));
}

async function upsertCatalogEntry(admin, kind, entityId, values = {}) {
  const definition = await ensureCatalogDefinition(admin, kind);
  const metaobjectType = definition.type;
  const handle = catalogHandle(entityId);
  const config = CATALOG_KINDS[kind];
  const fieldInputs = buildCatalogFieldInputs(config.fields, values);

  const upsertResult = await admin.graphql(
    `#graphql
    mutation UpsertCatalogEntry($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
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
        handle: { type: metaobjectType, handle },
        metaobject: { fields: fieldInputs },
      },
    },
  );
  const upsertJson = await upsertResult.json();
  const upsertPayload = upsertJson?.data?.metaobjectUpsert;
  const upsertError = mutationUserErrors(upsertPayload, "metaobjectUpsert");
  if (upsertError) throw new Error(upsertError);
  if (upsertPayload?.metaobject?.id) return upsertPayload.metaobject;

  const createResult = await admin.graphql(
    `#graphql
    mutation CreateCatalogEntry($metaobject: MetaobjectCreateInput!) {
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
          handle,
          fields: fieldInputs,
        },
      },
    },
  );
  const createJson = await createResult.json();
  const createPayload = createJson?.data?.metaobjectCreate;
  const createError = mutationUserErrors(createPayload, "metaobjectCreate");
  if (createError) throw new Error(createError);

  return createPayload?.metaobject || null;
}

async function fetchLocaleTranslationsOnce(admin, metaobjectId, locale) {
  const localeCode = normalizeShopLocale(locale)?.replace(/_/g, "-");
  if (!metaobjectId || !localeCode) return {};

  try {
    const res = await admin.graphql(
      `#graphql
      query CatalogTranslations($id: ID!, $locale: String!) {
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
  const full = normalizeShopLocale(locale)?.replace(/_/g, "-");
  if (base && full && base !== full) {
    localized = await fetchLocaleTranslationsOnce(admin, metaobjectId, base);
  }
  return localized;
}

function catalogEntryIsPopulated(entry, requiredKeys) {
  if (!entry?.fields?.length) return false;
  const map = parseMetaobjectFieldMap(entry.fields);
  return requiredKeys.every((key) => Boolean(map[key]?.trim()));
}

export async function upsertServiceTextMetaobject(admin, shopDomain, serviceId, values) {
  return upsertCatalogEntry(admin, "service", serviceId, values);
}

export async function upsertMeetingTypeTextMetaobject(
  admin,
  shopDomain,
  meetingTypeId,
  values,
) {
  return upsertCatalogEntry(admin, "meetingType", meetingTypeId, values);
}

export async function deleteCatalogTextMetaobject(admin, kind, entityId) {
  const definition = await resolveCatalogDefinition(admin, kind);
  if (!definition?.type) return;

  const entry = await getCatalogEntryByHandle(admin, definition.type, entityId);
  if (!entry?.id) return;

  await admin.graphql(
    `#graphql
    mutation DeleteCatalogEntry($id: ID!) {
      metaobjectDelete(id: $id) {
        userErrors { field message }
      }
    }`,
    { variables: { id: entry.id } },
  );
}

export async function getCatalogMetaobjectId(admin, kind, entityId) {
  const definition = await resolveCatalogDefinition(admin, kind);
  if (!definition?.type) return null;
  const entry = await getCatalogEntryByHandle(admin, definition.type, entityId);
  return entry?.id || null;
}

export async function isCatalogTextSyncedForShopLocale(
  admin,
  kind,
  metaobjectId,
  shopLocale,
  shopDomain,
  shopContext = null,
) {
  const config = CATALOG_KINDS[kind];
  if (!config || !metaobjectId) return false;

  const appLanguage = normalizeLanguage(localeToLanguage(shopLocale));
  if (!appLanguage) return false;

  let primaryLocaleCode = shopContext?.primaryLocaleCode;
  let seedLanguage = shopContext?.seedLanguage;
  if (primaryLocaleCode == null || seedLanguage == null) {
    const [{ locale }, seed] = await Promise.all([
      fetchShopPrimaryLocale(admin, shopDomain),
      getMetaobjectSeedLanguage(admin, shopDomain),
    ]);
    primaryLocaleCode = locale;
    seedLanguage = seed;
    if (shopContext) {
      shopContext.primaryLocaleCode = primaryLocaleCode;
      shopContext.seedLanguage = seedLanguage;
    }
  }

  const localeCode = normalizeShopLocale(shopLocale);

  if (
    appLanguage === seedLanguage ||
    localesEquivalent(localeCode, primaryLocaleCode)
  ) {
    const cache = shopContext?.entryPopulation;
    if (cache?.has(metaobjectId)) {
      return cache.get(metaobjectId);
    }

    const res = await admin.graphql(
      `#graphql
      query CatalogEntryById($id: ID!) {
        metaobject(id: $id) {
          id
          fields { key value }
        }
      }`,
      { variables: { id: metaobjectId } },
    );
    const json = await res.json();
    const populated = catalogEntryIsPopulated(
      json?.data?.metaobject,
      config.requiredKeys,
    );
    if (cache) cache.set(metaobjectId, populated);
    return populated;
  }

  const localized = await fetchLocaleTranslations(admin, metaobjectId, localeCode);
  return config.requiredKeys.some((key) => Boolean(localized[key]?.trim()));
}

export async function listCatalogMetaobjectIds(admin, kind, entityIds) {
  const definition = await resolveCatalogDefinition(admin, kind);
  if (!definition?.type || !entityIds?.length) {
    return Object.fromEntries((entityIds || []).map((id) => [id, null]));
  }

  const map = Object.fromEntries(entityIds.map((id) => [id, null]));
  await Promise.all(
    entityIds.map(async (entityId) => {
      const entry = await getCatalogEntryByHandle(admin, definition.type, entityId);
      if (entry?.id) map[entityId] = entry.id;
    }),
  );
  return map;
}

/** Banner helper — one pass per locale, cached shop context. */
export async function summarizeCatalogTranslationGaps(
  admin,
  shopDomain,
  kind,
  entityIds,
) {
  const config = CATALOG_KINDS[kind];
  const unsyncedLocales = new Set();

  if (!config || !entityIds?.length) {
    return { unsyncedLocales };
  }

  const [{ locales }, metaobjectIds] = await Promise.all([
    import("./booking-widget-i18n-metaobject.server.js").then((m) =>
      m.fetchAllShopLocales(admin, shopDomain),
    ),
    listCatalogMetaobjectIds(admin, kind, entityIds),
  ]);

  const nonPrimary = (locales || []).filter((row) => !row.primary);
  if (!nonPrimary.length) {
    return { unsyncedLocales };
  }

  const hasMissingEntry = entityIds.some((entityId) => !metaobjectIds[entityId]);
  if (hasMissingEntry) {
    for (const locale of nonPrimary) {
      unsyncedLocales.add(locale.locale);
    }
    return { unsyncedLocales };
  }

  const shopContext = { entryPopulation: new Map() };

  for (const locale of nonPrimary) {
    for (const entityId of entityIds) {
      const metaobjectId = metaobjectIds[entityId];
      if (!metaobjectId) {
        unsyncedLocales.add(locale.locale);
        break;
      }
      const synced = await isCatalogTextSyncedForShopLocale(
        admin,
        kind,
        metaobjectId,
        locale.locale,
        shopDomain,
        shopContext,
      );
      if (!synced) {
        unsyncedLocales.add(locale.locale);
        break;
      }
    }
  }

  return { unsyncedLocales };
}

export async function resolveCatalogTextForStorefront(
  admin,
  kind,
  entityId,
  shopLocale,
  shopDomain,
  fallback = {},
) {
  const config = CATALOG_KINDS[kind];
  const definition = await resolveCatalogDefinition(admin, kind);
  if (!definition?.type) return { ...fallback };

  const entry = await getCatalogEntryByHandle(admin, definition.type, entityId);
  if (!entry?.id) return { ...fallback };

  const { locale: primaryLocaleCode } = await fetchShopPrimaryLocale(admin, shopDomain);
  const localeCode = normalizeShopLocale(shopLocale) || primaryLocaleCode;
  const baseMap = parseMetaobjectFieldMap(entry.fields);
  let values = { ...fallback, ...baseMap };

  if (!localesEquivalent(localeCode, primaryLocaleCode)) {
    const localized = await fetchLocaleTranslations(admin, entry.id, localeCode);
    const hasLocalized = config.fields.some((field) =>
      Boolean(localized[field.key]?.trim()),
    );
    if (hasLocalized) {
      values = { ...values, ...localized };
    }
  }

  return values;
}

export { translateAndAdaptMetaobjectUrl };
