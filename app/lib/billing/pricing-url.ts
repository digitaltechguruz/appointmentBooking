import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_APP_HANDLE = "appointment-booking";
const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/i;

type TomlAppConfig = {
  clientId: string;
  handle: string;
};

let tomlConfig: TomlAppConfig | null | undefined;

function readTomlAppConfig(): TomlAppConfig {
  if (tomlConfig !== undefined) return tomlConfig ?? { clientId: "", handle: "" };

  try {
    const toml = readFileSync(resolve(process.cwd(), "shopify.app.toml"), "utf8");
    const clientId = toml.match(/^client_id\s*=\s*"([^"]+)"/m)?.[1] ?? "";
    // App-level handle is the first top-level `handle =` before any [section]
    const handle =
      toml.match(/^handle\s*=\s*"([^"]+)"/m)?.[1] ??
      toml.match(/\nhandle\s*=\s*"([^"]+)"/)?.[1] ??
      "";
    tomlConfig = { clientId, handle };
    return tomlConfig;
  } catch {
    tomlConfig = { clientId: "", handle: "" };
    return tomlConfig;
  }
}

export function getShopifyAppHandle() {
  const raw = process.env.SHOPIFY_APP_HANDLE?.trim();
  if (raw && HANDLE_RE.test(raw)) {
    return raw.toLowerCase();
  }

  const fromToml = readTomlAppConfig().handle.trim();
  if (fromToml && HANDLE_RE.test(fromToml)) {
    return fromToml.toLowerCase();
  }

  return DEFAULT_APP_HANDLE;
}

export function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, "");
}

function getShopifyClientId() {
  return (
    process.env.SHOPIFY_API_KEY?.trim() ||
    process.env.SHOPIFY_CLIENT_ID?.trim() ||
    readTomlAppConfig().clientId.trim() ||
    ""
  );
}

/**
 * Shopify App Pricing plan selection page.
 * @see https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/redirect-plan-selection-page
 */
export function getPlanSelectionUrl(shop: string) {
  const appHandle = getShopifyAppHandle();
  return `shopify://admin/charges/${appHandle}/pricing_plans`;
}

/** Absolute HTTPS URL (debug / copy link). */
export function getPlanSelectionAbsoluteUrl(shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = getShopifyAppHandle();
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

/** Alternate URL some stores resolve when the admin.shopify.com path 404s. */
export function getPlanSelectionMyshopifyUrl(shop: string) {
  const appHandle = getShopifyAppHandle();
  const host = shop.includes(".") ? shop : `${shop}.myshopify.com`;
  return `https://${host}/admin/charges/${appHandle}/pricing_plans`;
}

export function getShopifyClientIdForBilling() {
  return getShopifyClientId();
}
