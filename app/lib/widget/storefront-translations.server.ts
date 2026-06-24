import { DEFAULT_LABELS } from "../translations/defaults";
import { getDefaultTranslationValues } from "./widget-text.translations.js";
import {
  localeToLanguage,
  mapToSupportedLanguage,
} from "./booking-widget-i18n-metaobject.server.js";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function normalizeStorefrontLocale(locale: string) {
  const raw = (locale || "en").toString().trim();
  if (!raw) return "en";
  return raw.replace(/_/g, "-");
}

/** Map metaobject field values to widget label keys used by the React widget. */
export function metaobjectValuesToWidgetLabels(
  values: Record<string, string>,
): Record<string, string> {
  const labels: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) labels[key] = trimmed;
  };

  set("widget.title", values.title);
  set("widget.subtitle", values.subtitle);
  set("widget.selectService", values.step1_title);
  set("widget.step1Subtitle", values.step1_subtitle);
  set("widget.selectMeetingType", values.step2_title);
  set("widget.step2Subtitle", values.step2_subtitle);
  set("widget.step3Intro", values.step3_intro);
  set("widget.selectDateTime", values.step3_title);
  set("widget.customerInfo", values.step4_title);
  set("widget.step4Subtitle", values.step4_subtitle);
  set("widget.review", values.step5_title);
  set("widget.step5Subtitle", values.step5_subtitle);
  set("widget.confirm", values.primary_button_text);
  set("widget.confirmation", values.confirmation_text);
  set("widget.bookingConfirmed", values.confirmation_text);

  set("widget.firstNameLabel", values.first_name_label);
  set("widget.firstNamePlaceholder", values.first_name_placeholder);
  set("widget.lastNameLabel", values.last_name_label);
  set("widget.lastNamePlaceholder", values.last_name_placeholder);
  set("widget.emailLabel", values.email_label);
  set("widget.emailPlaceholder", values.email_placeholder);
  set("widget.phone", values.phone_label);
  set("widget.countryCode", values.country_region_label);
  set("widget.phoneNumber", values.phone_number_label);
  set("widget.phonePlaceholder", values.phone_placeholder);
  set("widget.note", values.note_label);
  set("widget.notePlaceholder", values.note_placeholder);

  set("widget.back", values.back_button);
  set("widget.next", values.next_button);
  set("widget.cancel", values.cancel_button);
  set("widget.confirming", values.confirming_button);

  set("widget.availableTimes", values.available_times);
  set("widget.timezoneHint", values.timezone_hint);
  set("widget.selectDateFirst", values.select_date_first);
  set("widget.noSlots", values.no_slots);
  set("widget.minutes", values.minutes_label);
  set("widget.loading", values.loading_label);
  set("widget.loadingAvailability", values.loading_availability);

  set("widget.reviewAppointment", values.review_appointment_label);
  set("widget.reviewDateTime", values.review_datetime_label);
  set("widget.reviewFullName", values.review_full_name_label);
  set("widget.reviewEmail", values.review_email_label);
  set("widget.reviewNote", values.review_note_label);

  set("widget.stepperServicesTitle", values.stepper_services_title);
  set("widget.stepperServicesSubtitle", values.stepper_services_subtitle);
  set("widget.stepperMeetingTitle", values.stepper_meeting_title);
  set("widget.stepperMeetingSubtitle", values.stepper_meeting_subtitle);
  set("widget.stepperCalendarTitle", values.stepper_calendar_title);
  set("widget.stepperCalendarSubtitle", values.stepper_calendar_subtitle);
  set("widget.stepperDetailsTitle", values.stepper_details_title);
  set("widget.stepperDetailsSubtitle", values.stepper_details_subtitle);
  set("widget.stepperReviewTitle", values.stepper_review_title);
  set("widget.stepperReviewSubtitle", values.stepper_review_subtitle);

  return labels;
}

export async function resolveStorefrontTranslationValues(
  shop: string,
  locale: string,
  admin?: AdminClient | null,
) {
  const normalizedLocale = normalizeStorefrontLocale(locale);
  const language = mapToSupportedLanguage(localeToLanguage(normalizedLocale));

  let adminClient = admin;
  if (!adminClient?.graphql) {
    try {
      const { unauthenticated } = await import("../../shopify.server.js");
      const offline = await unauthenticated.admin(shop);
      adminClient = offline?.admin as AdminClient | undefined;
    } catch {
      adminClient = undefined;
    }
  }

  if (adminClient?.graphql) {
    try {
      const { resolveWidgetI18nForStorefront } = await import(
        "./booking-widget-i18n-metaobject.server.js"
      );
      const i18n = await resolveWidgetI18nForStorefront(
        adminClient,
        normalizedLocale,
        shop,
      );
      if (i18n?.translationValues) {
        return {
          locale: normalizedLocale,
          language: i18n.language || language,
          translationValues: i18n.translationValues,
        };
      }
    } catch (error) {
      console.warn("[storefront-translations] metaobject:", error);
    }
  }

  return {
    locale: normalizedLocale,
    language,
    translationValues: getDefaultTranslationValues(language),
  };
}

export async function getStorefrontWidgetTranslations(
  shop: string,
  locale: string,
  admin?: AdminClient | null,
) {
  const resolved = await resolveStorefrontTranslationValues(shop, locale, admin);
  const fromMeta = metaobjectValuesToWidgetLabels(resolved.translationValues);

  return {
    locale: resolved.locale,
    language: resolved.language,
    translations: {
      ...DEFAULT_LABELS,
      ...fromMeta,
    },
  };
}
