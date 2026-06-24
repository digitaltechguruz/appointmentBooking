import { AppLocale, DayOfWeek, MeetingTypeKind, SubscriptionPlan } from "@prisma/client";

export const SUPPORTED_LOCALES: AppLocale[] = [
  "en",
  "fr",
  "de",
  "nl",
  "it",
  "es",
  "ru",
  "ar",
];

export const RTL_LOCALES: AppLocale[] = ["ar"];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const MEETING_TYPE_KINDS: MeetingTypeKind[] = [
  "ZOOM",
  "PHONE",
  "WHATSAPP",
  "IN_STORE",
  "CUSTOM",
];

export const MEETING_TYPE_LABELS: Record<MeetingTypeKind, string> = {
  ZOOM: "Zoom Video Call",
  GOOGLE_MEET: "Google Meet",
  PHONE: "Phone Call",
  WHATSAPP: "WhatsApp Call",
  IN_STORE: "In Store Meeting",
  CUSTOM: "Custom",
};

/** Optional integration behavior — storefront copy comes from name/subtitle/description. */
export const MEETING_TYPE_INTEGRATION_OPTIONS: Array<{
  value: MeetingTypeKind;
  label: string;
  details: string;
  requiresIntegration?: "zoom" | "google";
}> = [
  {
    value: "CUSTOM",
    label: "Custom (recommended)",
    details: "You control all text and images. No automatic video link.",
  },
  {
    value: "ZOOM",
    label: "Zoom integration",
    details: "Auto-create a Zoom meeting link when this type is booked.",
    requiresIntegration: "zoom",
  },
  {
    value: "GOOGLE_MEET",
    label: "Google Meet integration",
    details: "Auto-create a Google Meet link and calendar event when booked.",
    requiresIntegration: "google",
  },
  {
    value: "PHONE",
    label: "Phone",
    details: "Uses phone theme default image if no upload.",
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
    details: "Uses WhatsApp theme default image if no upload.",
  },
  {
    value: "IN_STORE",
    label: "In-store",
    details: "Uses in-store theme default image if no upload.",
  },
];

export type IntegrationConnections = {
  google: boolean;
  zoom: boolean;
  googleEmail?: string | null;
  zoomEmail?: string | null;
};

export function getMeetingIntegrationOptions(connections: IntegrationConnections) {
  return MEETING_TYPE_INTEGRATION_OPTIONS.filter((opt) => {
    if (opt.requiresIntegration === "zoom") return connections.zoom;
    if (opt.requiresIntegration === "google") return connections.google;
    return true;
  });
}

/** Pick a valid integration type when the saved type is no longer available. */
export function meetingTypeHasVideoLink(meetingType: {
  videoLinkEnabled?: boolean;
  type: MeetingTypeKind;
}) {
  return (
    meetingType.videoLinkEnabled ||
    meetingType.type === "ZOOM" ||
    meetingType.type === "GOOGLE_MEET"
  );
}

export const DEFAULT_WORKING_HOURS = {
  startTime: "09:00",
  endTime: "17:00",
} as const;

export const SLOT_INTERVAL_MINUTES = 30;

export const BILLING_PLANS = {
  FREE: {
    plan: SubscriptionPlan.FREE,
    name: "Free Plan",
    bookingLimit: 10,
    features: ["Limited bookings", "Basic functionality"],
  },
  SHOPIFY_TEST: {
    plan: SubscriptionPlan.SHOPIFY_TEST,
    name: "Shopify Test Plan",
    bookingLimit: null,
    features: ["Development testing"],
  },
  TEST: {
    plan: SubscriptionPlan.TEST,
    name: "Test Plan",
    bookingLimit: null,
    features: ["Development testing"],
  },
  LEGACY_ACCESS: {
    plan: SubscriptionPlan.LEGACY_ACCESS,
    name: "Legacy Access",
    bookingLimit: null,
    features: ["Grandfathered premium access"],
  },
  ANNUAL_PREMIUM: {
    plan: SubscriptionPlan.ANNUAL_PREMIUM,
    name: "Annual Premium Plan",
    bookingLimit: null,
    features: ["Unlimited bookings", "All integrations", "Priority support"],
  },
} as const;

export const DEFAULT_TRANSLATION_KEYS = [
  "widget.title",
  "widget.subtitle",
  "widget.selectService",
  "widget.selectMeetingType",
  "widget.selectDateTime",
  "widget.step1Subtitle",
  "widget.step2Subtitle",
  "widget.step3Intro",
  "widget.step4Subtitle",
  "widget.step5Subtitle",
  "widget.customerInfo",
  "widget.review",
  "widget.confirm",
  "widget.confirmation",
  "widget.firstNameLabel",
  "widget.firstNamePlaceholder",
  "widget.lastNameLabel",
  "widget.lastNamePlaceholder",
  "widget.emailLabel",
  "widget.emailPlaceholder",
  "widget.phone",
  "widget.phoneNumber",
  "widget.countryCode",
  "widget.phonePlaceholder",
  "widget.note",
  "widget.notePlaceholder",
  "widget.next",
  "widget.back",
  "widget.cancel",
  "widget.confirming",
  "widget.noSlots",
  "widget.bookingConfirmed",
  "widget.duration",
  "widget.minutes",
  "widget.availableTimes",
  "widget.timezoneHint",
  "widget.selectDateFirst",
  "widget.loading",
  "widget.loadingAvailability",
  "widget.reviewAppointment",
  "widget.reviewDateTime",
  "widget.reviewFullName",
  "widget.reviewEmail",
  "widget.reviewNote",
  "widget.stepperServicesTitle",
  "widget.stepperServicesSubtitle",
  "widget.stepperMeetingTitle",
  "widget.stepperMeetingSubtitle",
  "widget.stepperCalendarTitle",
  "widget.stepperCalendarSubtitle",
  "widget.stepperDetailsTitle",
  "widget.stepperDetailsSubtitle",
  "widget.stepperReviewTitle",
  "widget.stepperReviewSubtitle",
  "widget.available",
  "widget.unavailable",
  "widget.closed",
] as const;

export type TranslationKey = (typeof DEFAULT_TRANSLATION_KEYS)[number];
