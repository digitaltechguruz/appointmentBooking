type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ShopInfo = {
  name: string | null;
  email: string | null;
  ianaTimezone: string;
};

export async function fetchShopInfo(admin: AdminGraphql): Promise<ShopInfo> {
  const response = await admin.graphql(`#graphql
    query shopInfo {
      shop {
        name
        email
        contactEmail
        ianaTimezone
      }
    }
  `);
  const payload = (await response.json()) as {
    data?: {
      shop?: {
        name?: string | null;
        email?: string | null;
        contactEmail?: string | null;
        ianaTimezone?: string | null;
      };
    };
  };
  const shop = payload.data?.shop;
  const contactEmail = shop?.contactEmail?.trim() || shop?.email?.trim() || null;

  return {
    name: shop?.name?.trim() || null,
    email: contactEmail,
    ianaTimezone: shop?.ianaTimezone?.trim() || "UTC",
  };
}

export async function fetchShopIanaTimezone(admin: AdminGraphql): Promise<string> {
  const info = await fetchShopInfo(admin);
  return info.ianaTimezone;
}
