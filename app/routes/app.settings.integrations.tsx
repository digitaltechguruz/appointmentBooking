import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { requireAdminMerchant } from "../lib/auth.server";
import { getOrCreateMerchant } from "../models/merchant.server";
import { syncMerchantSubscriptionFromShopify } from "../lib/billing/billing.server";
import { getGoogleConnection, disconnectGoogle } from "../lib/integrations/google/calendar.server";
import { getZoomConnection, disconnectZoom } from "../lib/integrations/zoom/meetings.server";
import { hasPremiumAccess } from "../models/subscription.server";
import { SettingsIntegrationsSection } from "../components/admin/SettingsIntegrationsSection";
import { useAdminI18n } from "../lib/admin-i18n";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const merchant = await getOrCreateMerchant(session.shop);

  try {
    await syncMerchantSubscriptionFromShopify(
      merchant.id,
      request,
      billing,
      admin,
    );
  } catch (error) {
    console.warn("[settings/integrations] billing sync:", error);
  }

  const [google, zoom, premium] = await Promise.all([
    getGoogleConnection(merchant.id),
    getZoomConnection(merchant.id),
    hasPremiumAccess(merchant.id),
  ]);

  return { google, zoom, hasPremium: premium };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "disconnect-google") await disconnectGoogle(merchant.id);
  if (intent === "disconnect-zoom") await disconnectZoom(merchant.id);
  return { ok: true };
};

export default function SettingsIntegrationsPage() {
  const { t } = useAdminI18n();
  const { google, zoom, hasPremium } = useLoaderData<typeof loader>();

  return (
    <section className="ab-settings-layout__panel">
      <header className="ab-settings-layout__panel-head">
        <h2 className="ab-settings-layout__panel-title">
          {t("settings.integrationsTitle")}
        </h2>
        <p className="ab-settings-layout__panel-desc">
          {t("settings.integrationsDesc")}
        </p>
      </header>

      <div className="ab-settings-layout__panel-body ab-settings-layout__panel-body--integrations">
        <SettingsIntegrationsSection
          google={google}
          zoom={zoom}
          hasPremium={hasPremium}
        />
      </div>
    </section>
  );
}

export const headers = boundary.headers;
