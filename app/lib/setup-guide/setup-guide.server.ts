import type { WidgetTheme } from "@prisma/client";
import prisma from "../../db.server";
import {
  DEFAULT_WIDGET_APPEARANCE,
  parseWidgetAppearance,
} from "../widget/appearance.server";
import { detectBookingWidgetOnTheme } from "./theme-widget-status.server";

export const SETUP_STEP_IDS = [
  "services",
  "linkMeetingTypes",
  "availability",
  "widgetTheme",
  "widgetAppearance",
  "languages",
  "firstBooking",
] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupGuideStep = {
  id: SetupStepId;
  completed: boolean;
  manual: boolean;
};

export type SetupGuideData = {
  steps: SetupGuideStep[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
};

type SetupGuideState = {
  manual?: Partial<Record<SetupStepId, boolean>>;
};

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GetSetupGuideOptions = {
  admin?: AdminClient | null;
  shop?: string;
};

function parseSetupGuideState(raw: unknown): SetupGuideState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const manual = (raw as SetupGuideState).manual;
  if (!manual || typeof manual !== "object") {
    return {};
  }
  return { manual };
}

function isManualStepComplete(
  state: SetupGuideState,
  stepId: SetupStepId,
): boolean {
  return Boolean(state.manual?.[stepId]);
}

function stepResult(
  id: SetupStepId,
  autoComplete: boolean,
  state: SetupGuideState,
): SetupGuideStep {
  const completed = autoComplete || isManualStepComplete(state, id);
  return {
    id,
    completed,
    manual: !autoComplete,
  };
}

function hasCustomizedWidgetAppearance(
  widgetContent: unknown,
  widgetTheme: WidgetTheme,
) {
  if (widgetTheme !== "CLASSIC") return true;

  const appearance = parseWidgetAppearance(widgetContent);
  return (
    appearance.primaryColor !== DEFAULT_WIDGET_APPEARANCE.primaryColor ||
    appearance.accentColor !== DEFAULT_WIDGET_APPEARANCE.accentColor ||
    Object.keys(appearance.defaultImages).length > 0
  );
}

async function isStorefrontLanguagesConfigured(
  admin: AdminClient | null | undefined,
  shop: string | undefined,
) {
  if (!admin?.graphql || !shop) return false;

  try {
    const { getWidgetTextSummary, fetchAllShopLocales, isWidgetTextSyncedForShopLocale } =
      await import("../widget/booking-widget-i18n-metaobject.server.js");

    const summary = await getWidgetTextSummary(admin, shop);
    if (summary.ok) return true;

    const { locales } = await fetchAllShopLocales(admin, shop);
    if (locales.length <= 1) return false;

    const extraLocales = locales.filter((row) => !row.primary && row.appSupported);
    if (extraLocales.length === 0) return false;

    const syncResults = await Promise.all(
      extraLocales.map((row) =>
        isWidgetTextSyncedForShopLocale(admin, row.locale, shop),
      ),
    );
    return syncResults.some(Boolean);
  } catch (error) {
    console.warn("[setup-guide] languages detection:", error);
    return false;
  }
}

export async function getSetupGuide(
  merchantId: string,
  merchant: {
    setupGuideState: unknown;
    widgetContent: unknown;
    widgetTheme: WidgetTheme;
  },
  options: GetSetupGuideOptions = {},
): Promise<SetupGuideData> {
  const state = parseSetupGuideState(merchant.setupGuideState);
  const { admin, shop } = options;

  const [
    activeServices,
    linkedActiveServices,
    enabledAvailabilityRules,
    confirmedBookings,
    themeWidgetStatus,
    languagesConfigured,
  ] = await Promise.all([
    prisma.service.count({ where: { merchantId, active: true } }),
    prisma.service.count({
      where: {
        merchantId,
        active: true,
        meetingTypes: { some: {} },
      },
    }),
    prisma.availabilityRule.count({
      where: { merchantId, enabled: true },
    }),
    prisma.booking.count({
      where: { merchantId, status: "CONFIRMED" },
    }),
    detectBookingWidgetOnTheme(admin),
    isStorefrontLanguagesConfigured(admin, shop),
  ]);

  const widgetAppearanceConfigured = hasCustomizedWidgetAppearance(
    merchant.widgetContent,
    merchant.widgetTheme,
  );

  const steps: SetupGuideStep[] = [
    stepResult("services", activeServices > 0, state),
    stepResult("linkMeetingTypes", linkedActiveServices > 0, state),
    stepResult("availability", enabledAvailabilityRules > 0, state),
    stepResult("widgetTheme", themeWidgetStatus.installed, state),
    stepResult("widgetAppearance", widgetAppearanceConfigured, state),
    stepResult("languages", languagesConfigured, state),
    stepResult("firstBooking", confirmedBookings > 0, state),
  ];

  const completedCount = steps.filter((step) => step.completed).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allComplete: completedCount === steps.length,
  };
}

export async function markSetupStepComplete(
  merchantId: string,
  stepId: SetupStepId,
) {
  if (!SETUP_STEP_IDS.includes(stepId)) {
    throw new Error("Invalid setup step");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { setupGuideState: true },
  });

  if (!merchant) {
    throw new Error("Merchant not found");
  }

  const state = parseSetupGuideState(merchant.setupGuideState);
  const manual = { ...state.manual, [stepId]: true };

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      setupGuideState: { manual },
    },
  });
}
