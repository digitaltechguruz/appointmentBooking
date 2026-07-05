type BillablePlan = {
  handle: string;
  name: string;
  priceLabel: string;
  features: readonly string[];
  plan: string;
};

function planLocaleKey(handle: string): string {
  return handle === "free-plan" ? "freePlan" : handle;
}

export function translateBillingPlan(
  plan: BillablePlan,
  t: (key: string, vars?: Record<string, unknown>) => string,
) {
  const key = planLocaleKey(plan.handle);
  const features = plan.features.map((_, index) => {
    const translated = t(`billing.plans.${key}.features.${index}`);
    return translated.startsWith("billing.plans.") ? plan.features[index] : translated;
  });

  const name = t(`billing.plans.${key}.name`);
  const priceLabel = t(`billing.plans.${key}.priceLabel`);

  return {
    ...plan,
    name: name.startsWith("billing.plans.") ? plan.name : name,
    priceLabel: priceLabel.startsWith("billing.plans.") ? plan.priceLabel : priceLabel,
    features,
  };
}

export function translatePlanName(
  planHandle: string,
  fallback: string,
  t: (key: string) => string,
): string {
  const key = planLocaleKey(planHandle);
  const name = t(`billing.plans.${key}.name`);
  return name.startsWith("billing.plans.") ? fallback : name;
}
