import { useEffect, type ReactNode } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useAdminI18n } from "../../lib/admin-i18n";
import { showAppToast, useFetcherIdleResult } from "../../lib/admin/toast";

function IconGoogleCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M18 4h-1V2h-2v2H9V2H7v2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"
      />
      <path fill="#fff" d="M6 8h12v10H6V8Z" />
      <path fill="#EA4335" d="M12 11h3v3h-3v-3Z" />
      <path fill="#FBBC04" d="M9 11h3v3H9v-3Z" />
      <path fill="#34A853" d="M12 14h3v3h-3v-3Z" />
      <path fill="#4285F4" d="M9 14h3v3H9v-3Z" />
    </svg>
  );
}

function IconZoom() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#2D8CFF" />
      <path
        fill="#fff"
        d="M9.2 8.8v6.4l5.6-3.2-5.6-3.2Zm3.8 3.2-3.8 2.2V9.8l3.8 2.2Zm1.6 0 3.2 1.8V9.4l-3.2 1.8Z"
      />
    </svg>
  );
}

function IntegrationRow({
  icon,
  iconClass,
  title,
  description,
  connected,
  disconnectIntent,
  onConnect,
  fetcher,
  billingFetcher,
  locked,
  lockedMessage,
  t,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
  connected: boolean;
  disconnectIntent: string;
  onConnect: () => void;
  fetcher: ReturnType<typeof useFetcher>;
  billingFetcher: ReturnType<typeof useFetcher>;
  locked?: boolean;
  lockedMessage?: string;
  t: (key: string, vars?: Record<string, unknown>) => string;
}) {
  return (
    <div className="ab-home__integration">
      <div className={`ab-home__integration-icon ${iconClass}`}>{icon}</div>
      <div className="ab-home__integration-body">
        <div className="ab-home__integration-title">{title}</div>
        <div className="ab-home__integration-desc">
          {locked && !connected ? lockedMessage : description}
        </div>
      </div>
      <div className="ab-home__integration-action">
        {connected ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value={disconnectIntent} />
            <s-button type="submit" tone="critical" variant="tertiary">
              {t("common.disconnect")}
            </s-button>
          </fetcher.Form>
        ) : locked ? (
          <billingFetcher.Form method="post" action="/app/billing">
            <s-button type="submit" loading={billingFetcher.state !== "idle"}>
              {t("common.upgradeToPro")}
            </s-button>
          </billingFetcher.Form>
        ) : (
          <s-button onClick={onConnect}>{t("common.connect")}</s-button>
        )}
      </div>
    </div>
  );
}

type Props = {
  google: { email: string | null } | null;
  zoom: { email: string | null } | null;
  hasPremium: boolean;
};

export function SettingsIntegrationsSection({ google, zoom, hasPremium }: Props) {
  const { t } = useAdminI18n();
  const fetcher = useFetcher();
  const billingFetcher = useFetcher();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data === "object" && data != null && "ok" in data && data.ok) {
      showAppToast(shopify, t("toast.disconnected"));
    }
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "google") {
      showAppToast(shopify, t("toast.googleConnected"));
      setSearchParams({}, { replace: true });
    } else if (connected === "zoom") {
      showAppToast(shopify, t("toast.zoomConnected"));
      setSearchParams({}, { replace: true });
    } else if (error === "google_denied") {
      showAppToast(shopify, t("toast.googleDenied"), { isError: true });
      setSearchParams({}, { replace: true });
    } else if (error === "google_failed") {
      showAppToast(shopify, t("toast.googleFailed"), { isError: true });
      setSearchParams({}, { replace: true });
    } else if (error === "zoom_denied") {
      showAppToast(shopify, t("toast.zoomDenied"), { isError: true });
      setSearchParams({}, { replace: true });
    } else if (error === "zoom_failed") {
      showAppToast(shopify, t("toast.zoomFailed"), { isError: true });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, shopify, t]);

  async function connect(provider: "google" | "zoom") {
    const res = await fetch(`/api/${provider}/connect`, { method: "POST" });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    if (data.url) {
      window.open(data.url, "_top");
      return;
    }
    showAppToast(
      shopify,
      data.error ||
        (provider === "zoom" ? t("toast.connectZoomFailed") : t("toast.connectGoogleFailed")),
      { isError: true },
    );
  }

  const integrationLocked = !hasPremium;
  const integrationLockedMessage = t("dashboard.integrationLockedMessage");

  return (
    <div className="ab-home__integrations">
      <IntegrationRow
        icon={<IconGoogleCalendar />}
        iconClass="ab-home__integration-icon--google"
        title={t("dashboard.googleCalendarTitle")}
        description={
          google
            ? t("dashboard.googleConnectedAs", { email: google.email })
            : t("dashboard.googleCalendarDesc")
        }
        connected={Boolean(google)}
        disconnectIntent="disconnect-google"
        onConnect={() => connect("google")}
        fetcher={fetcher}
        billingFetcher={billingFetcher}
        locked={integrationLocked}
        lockedMessage={integrationLockedMessage}
        t={t}
      />
      <IntegrationRow
        icon={<IconZoom />}
        iconClass="ab-home__integration-icon--zoom"
        title={t("dashboard.zoomTitle")}
        description={
          zoom
            ? t("dashboard.zoomConnectedAs", { email: zoom.email })
            : t("dashboard.zoomDesc")
        }
        connected={Boolean(zoom)}
        disconnectIntent="disconnect-zoom"
        onConnect={() => connect("zoom")}
        fetcher={fetcher}
        billingFetcher={billingFetcher}
        locked={integrationLocked}
        lockedMessage={integrationLockedMessage}
        t={t}
      />
    </div>
  );
}
