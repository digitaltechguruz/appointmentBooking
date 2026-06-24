export type WidgetDefaultImages = {
  ZOOM?: string;
  PHONE?: string;
  WHATSAPP?: string;
  IN_STORE?: string;
};

/** Non-translatable widget settings stored in the database. */
export type WidgetAppearance = {
  visible: boolean;
  primaryColor: string;
  accentColor: string;
  defaultImages: WidgetDefaultImages;
};

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  visible: true,
  primaryColor: "#0d2e26",
  accentColor: "#f5f0e8",
  defaultImages: {},
};

export function emptyWidgetAppearance(): WidgetAppearance {
  return {
    ...DEFAULT_WIDGET_APPEARANCE,
    defaultImages: { ...DEFAULT_WIDGET_APPEARANCE.defaultImages },
  };
}

/** Text field keys stored in the Booking Widget Text metaobject. */
export type WidgetTextValues = {
  title: string;
  subtitle: string;
  step1_title: string;
  step1_subtitle: string;
  step2_title: string;
  step2_subtitle: string;
  step3_intro: string;
  step3_title: string;
  step3_subtitle: string;
  step4_title: string;
  step4_subtitle: string;
  step5_title: string;
  step5_subtitle: string;
  primary_button_text: string;
  confirmation_text: string;
};

export function metaobjectValuesToWidgetText(
  values: Record<string, string>,
): WidgetTextValues {
  return {
    title: values.title ?? "",
    subtitle: values.subtitle ?? "",
    step1_title: values.step1_title ?? "",
    step1_subtitle: values.step1_subtitle ?? "",
    step2_title: values.step2_title ?? "",
    step2_subtitle: values.step2_subtitle ?? "",
    step3_intro: values.step3_intro ?? "",
    step3_title: values.step3_title ?? "",
    step3_subtitle: values.step3_subtitle ?? "",
    step4_title: values.step4_title ?? "",
    step4_subtitle: values.step4_subtitle ?? "",
    step5_title: values.step5_title ?? "",
    step5_subtitle: values.step5_subtitle ?? "",
    primary_button_text: values.primary_button_text ?? "",
    confirmation_text: values.confirmation_text ?? "",
  };
}

export function widgetTextToClientSettings(
  text: WidgetTextValues,
  appearance: WidgetAppearance,
  options: { locale: string; theme: "classic" | "modern" },
) {
  return {
    title: text.title,
    subtitle: text.subtitle,
    step1Title: text.step1_title,
    step1Subtitle: text.step1_subtitle,
    step2Title: text.step2_title,
    step2Subtitle: text.step2_subtitle,
    step3Intro: text.step3_intro,
    step3Title: text.step3_title,
    step3Subtitle: text.step3_subtitle,
    step4Title: text.step4_title,
    step4Subtitle: text.step4_subtitle,
    step5Title: text.step5_title,
    step5Subtitle: text.step5_subtitle,
    primaryButtonText: text.primary_button_text,
    confirmationText: text.confirmation_text,
    primaryColor: appearance.primaryColor,
    accentColor: appearance.accentColor,
    visible: appearance.visible,
    locale: options.locale,
    theme: options.theme,
    defaultImages: appearance.defaultImages,
  };
}
