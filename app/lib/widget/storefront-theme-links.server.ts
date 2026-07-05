export function getStorefrontThemeEditorLinks(shop: string) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
  const adminBase = `https://admin.shopify.com/store/${storeHandle}`;

  return {
    addBlock: `${adminBase}/themes/current/editor?template=index&addAppBlockId=${apiKey}/booking-widget`,
    appEmbeds: `${adminBase}/themes/current/editor?context=apps`,
  };
}
