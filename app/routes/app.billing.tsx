import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useMemo } from "react";
import { authenticate } from "../shopify.server";
import { getOrCreateMerchant } from "../models/merchant.server";
import { syncMerchantSubscriptionFromShopify } from "../lib/billing/billing.server";
import { BILLING_PLANS, PUBLIC_BILLING_PLANS } from "../lib/constants";
import {
  getPlanSelectionUrl,
  getPlanSelectionAbsoluteUrl,
  getShopifyAppHandle,
} from "../lib/billing/pricing-url";
import { isPremiumPlan } from "../lib/billing/plans.shared";
import { translateBillingPlan, translatePlanName } from "../lib/admin/billing-i18n";
import { useAdminI18n } from "../lib/admin-i18n";
import billingStyles from "../components/admin/billing.css?url";

export const links = () => [{ rel: "stylesheet", href: billingStyles }];

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
    console.warn("[billing] sync:", error);
  }

  const refreshed = await getOrCreateMerchant(session.shop);

  return {
    subscription: refreshed.subscription,
    plans: PUBLIC_BILLING_PLANS,
    allPlans: Object.values(BILLING_PLANS),
    pricingUrl: getPlanSelectionAbsoluteUrl(session.shop),
    appHandle: getShopifyAppHandle(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, redirect } = await authenticate.admin(request);
  const pricingUrl = getPlanSelectionUrl(session.shop);
  return redirect(pricingUrl, { target: "_top" });
};

export default function BillingPage() {
  const { subscription, plans, allPlans, appHandle } = useLoaderData<typeof loader>();
  const { t } = useAdminI18n();
  const fetcher = useFetcher<typeof action>();
  const currentPlan = subscription?.plan ?? "FREE";
  const isPremium = isPremiumPlan(currentPlan);
  const currentPlanInfo = allPlans.find((p) => p.plan === currentPlan);
  const redirecting = fetcher.state !== "idle";

  const translatedPlans = useMemo(
    () => plans.map((plan) => translateBillingPlan(plan, t)),
    [plans, t],
  );

  const currentPlanLabel = useMemo(() => {
    const entry = allPlans.find((p) => p.plan === currentPlan);
    if (!entry) return currentPlan;
    return translatePlanName(entry.handle, entry.name, t);
  }, [allPlans, currentPlan, t]);

  const translatedCurrentPlanInfo = useMemo(() => {
    if (!currentPlanInfo) return null;
    return translateBillingPlan(currentPlanInfo, t);
  }, [currentPlanInfo, t]);

  return (
    <s-page heading={t("billing.pageTitle")}>
      <div className="ab-billing">
        <div className="ab-billing__status">
          <div>
            <div className="ab-billing__status-label">{t("billing.currentPlan")}</div>
            <div className="ab-billing__status-plan">{currentPlanLabel}</div>
            <div className="ab-billing__status-meta">
              {translatedCurrentPlanInfo?.priceLabel ?? ""}
              {subscription?.status
                ? ` · ${subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase()}`
                : ""}
            </div>
          </div>
          {isPremium ? (
            <fetcher.Form method="post">
              <s-button type="submit" loading={redirecting}>
                {t("billing.changePlan")}
              </s-button>
            </fetcher.Form>
          ) : null}
        </div>

        <div className="ab-billing__grid">
          {translatedPlans.map((plan) => {
            const isCurrent = plan.plan === currentPlan;
            const isPro = plan.plan === "PRO";

            return (
              <article
                key={plan.plan}
                className={[
                  "ab-billing__card",
                  isCurrent ? "ab-billing__card--current" : "",
                  isPro ? "ab-billing__card--featured" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isCurrent ? (
                  <span className="ab-billing__badge">{t("billing.currentBadge")}</span>
                ) : isPro ? (
                  <span className="ab-billing__badge ab-billing__badge--recommended">
                    {t("billing.recommended")}
                  </span>
                ) : null}

                <div className="ab-billing__card-head">
                  <h2 className="ab-billing__card-name">{plan.name}</h2>
                  <p className="ab-billing__card-price">{plan.priceLabel}</p>
                </div>

                <ul className="ab-billing__features">
                  {plan.features.map((feature) => (
                    <li key={feature} className="ab-billing__feature">
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="ab-billing__card-action">
                  {isCurrent ? (
                    <span className="ab-billing__current-label">{t("billing.activePlanLabel")}</span>
                  ) : (
                    <fetcher.Form method="post">
                      <s-button
                        type="submit"
                        variant={isPro ? "primary" : undefined}
                        loading={redirecting}
                      >
                        {isPro ? t("billing.upgradeNow") : t("billing.changePlan")}
                      </s-button>
                    </fetcher.Form>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="ab-billing__notice">
          <p>{t("billing.draftNotice")}</p>
          <p className="ab-billing__notice-meta">
            {t("billing.appHandleLabel")} <code>{appHandle}</code>
          </p>
        </div>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
