/** Short-lived per-shop cache to cut repeat Admin API calls during admin navigation. */

const store = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const I18N_TTL_MS = 60 * 1000;
const THEME_LINKS_TTL_MS = 10 * 60 * 1000;

function key(shop, namespace) {
  return `${shop || ""}:${namespace}`;
}

export function getShopCache(shop, namespace) {
  const entry = store.get(key(shop, namespace));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key(shop, namespace));
    return null;
  }
  return entry.value;
}

export function setShopCache(shop, namespace, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key(shop, namespace), {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateShopCache(shop, namespace) {
  if (namespace) {
    store.delete(key(shop, namespace));
    return;
  }
  const prefix = `${shop}:`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export const CACHE_TTL = {
  default: DEFAULT_TTL_MS,
  i18n: I18N_TTL_MS,
  themeLinks: THEME_LINKS_TTL_MS,
};
