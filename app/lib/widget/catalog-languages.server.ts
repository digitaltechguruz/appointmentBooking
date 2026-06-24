type AdminSession = {
  shop: string;
};

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type CatalogKind = "service" | "meetingType";

export type CatalogLocaleRow = {
  locale: string;
  name: string;
  primary: boolean;
  appSupported: boolean;
  synced: boolean;
  editUrl: string | null;
};

export type CatalogEntityTranslationRow = {
  entityId: string;
  entityName: string;
  metaobjectId: string | null;
  localeRows: CatalogLocaleRow[];
  hasUnsynced: boolean;
};

export type CatalogTranslationsBannerData = {
  metaobjectDefinitionName: string;
  unsyncedLocaleLabels: string[];
  hasAnyUnsynced: boolean;
};

function catalogKindKey(kind: CatalogKind): "service" | "meetingType" {
  return kind === "service" ? "service" : "meetingType";
}

function definitionName(kind: CatalogKind) {
  return kind === "service"
    ? "Book appointment service text"
    : "Book appointment meeting type text";
}

/** Fast path for page banner — checks non-primary locales only. */
export async function loadCatalogTranslationsBanner(
  admin: AdminClient,
  session: AdminSession,
  kind: CatalogKind,
  entities: Array<{ id: string; name: string }>,
): Promise<CatalogTranslationsBannerData> {
  const { fetchAllShopLocales } = await import(
    "./booking-widget-i18n-metaobject.server.js"
  );
  const { summarizeCatalogTranslationGaps } = await import(
    "./catalog-i18n-metaobject.server.js"
  );

  if (!entities.length) {
    return {
      metaobjectDefinitionName: definitionName(kind),
      unsyncedLocaleLabels: [],
      hasAnyUnsynced: false,
    };
  }

  const [{ locales }, summary] = await Promise.all([
    fetchAllShopLocales(admin, session.shop),
    summarizeCatalogTranslationGaps(
      admin,
      session.shop,
      catalogKindKey(kind),
      entities.map((entity) => entity.id),
    ),
  ]);

  const nonPrimary = locales.filter((row) => !row.primary);
  const unsyncedLocaleLabels = nonPrimary
    .filter((row) => summary.unsyncedLocales.has(row.locale))
    .map((row) => row.name);

  return {
    metaobjectDefinitionName: definitionName(kind),
    unsyncedLocaleLabels,
    hasAnyUnsynced: unsyncedLocaleLabels.length > 0,
  };
}

/** Loaded when an edit drawer opens — one entity, all store locales. */
export async function loadCatalogEntityTranslations(
  admin: AdminClient,
  session: AdminSession,
  kind: CatalogKind,
  entity: { id: string; name: string },
): Promise<CatalogEntityTranslationRow> {
  const { fetchAllShopLocales, fetchShopAdminHandle } = await import(
    "./booking-widget-i18n-metaobject.server.js"
  );
  const {
    getCatalogMetaobjectId,
    isCatalogTextSyncedForShopLocale,
    translateAndAdaptMetaobjectUrl,
  } = await import("./catalog-i18n-metaobject.server.js");

  const shop = session.shop;
  const catalogKind = catalogKindKey(kind);
  const [{ locales }, storeHandle, metaobjectId] = await Promise.all([
    fetchAllShopLocales(admin, shop),
    fetchShopAdminHandle(admin, shop),
    getCatalogMetaobjectId(admin, catalogKind, entity.id),
  ]);

  const localeRows: CatalogLocaleRow[] = await Promise.all(
    locales.map(async (row) => {
      const synced = metaobjectId
        ? await isCatalogTextSyncedForShopLocale(
            admin,
            catalogKind,
            metaobjectId,
            row.locale,
            shop,
          )
        : false;
      return {
        locale: row.locale,
        name: row.name,
        primary: row.primary,
        appSupported: row.appSupported,
        synced,
        editUrl: translateAndAdaptMetaobjectUrl(
          storeHandle,
          row.locale,
          metaobjectId,
        ),
      };
    }),
  );

  return {
    entityId: entity.id,
    entityName: entity.name,
    metaobjectId,
    localeRows,
    hasUnsynced: localeRows.some((row) => !row.primary && !row.synced),
  };
}
