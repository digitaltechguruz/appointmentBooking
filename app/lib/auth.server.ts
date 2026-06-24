import { authenticate } from "../shopify.server";
import { getOrCreateMerchant, syncMerchantFromShopifyAdmin } from "../models/merchant.server";
import { checkRateLimit, getRateLimitKey } from "./security/rate-limit.server";

export async function requireAdminMerchant(request: Request) {
  const { session, admin } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);
  const synced = await syncMerchantFromShopifyAdmin(merchant.id, admin);
  return { session, admin, merchant: synced ?? merchant };
}

export async function requirePublicMerchant(request: Request) {
  const url = new URL(request.url);
  let shop: string | undefined;
  let admin: Awaited<
    ReturnType<typeof authenticate.public.appProxy>
  >["admin"] | undefined;

  try {
    const context = await authenticate.public.appProxy(request);
    if (context.session?.shop) {
      shop = context.session.shop;
    }
    admin = context.admin ?? undefined;
  } catch {
    shop = url.searchParams.get("shop") ?? undefined;
  }

  if (!shop) {
    throw Response.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  if (!admin?.graphql) {
    try {
      const { unauthenticated } = await import("../shopify.server.js");
      const offline = await unauthenticated.admin(shop);
      admin = offline?.admin ?? undefined;
    } catch {
      admin = undefined;
    }
  }

  const rateLimit = checkRateLimit(getRateLimitKey(request, shop));
  if (!rateLimit.allowed) {
    throw Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }

  const merchant = await getOrCreateMerchant(shop);

  return { merchant, shop, admin };
}
