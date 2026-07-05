-- Align subscription plans with Shopify App Pricing handles: free-plan, pro, shopify-test

CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'PRO', 'SHOPIFY_TEST');

ALTER TABLE "Subscription"
  ALTER COLUMN "plan" DROP DEFAULT,
  ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
  USING (
    CASE "plan"::text
      WHEN 'FREE' THEN 'FREE'::"SubscriptionPlan_new"
      WHEN 'SHOPIFY_TEST' THEN 'SHOPIFY_TEST'::"SubscriptionPlan_new"
      ELSE 'PRO'::"SubscriptionPlan_new"
    END
  );

DROP TYPE "SubscriptionPlan";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";

ALTER TABLE "Subscription"
  ALTER COLUMN "plan" SET DEFAULT 'FREE';
