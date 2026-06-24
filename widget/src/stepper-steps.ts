export type BookingStepMeta = {
  title: string;
  subtitle: string;
  icon: "services" | "meeting" | "calendar" | "user" | "review";
};

export const BOOKING_STEP_META: BookingStepMeta[] = [
  { title: "Services", subtitle: "Choose a service", icon: "services" },
  { title: "Meeting type", subtitle: "How to meet", icon: "meeting" },
  { title: "Date & time", subtitle: "Pick a slot", icon: "calendar" },
  { title: "Your details", subtitle: "Contact information", icon: "user" },
  { title: "Review", subtitle: "Confirm booking", icon: "review" },
];

export type StepLabelLookup = (key: string, fallback: string) => string;

export function buildBookingStepMeta(t: StepLabelLookup): BookingStepMeta[] {
  return [
    {
      title: t("widget.stepperServicesTitle", BOOKING_STEP_META[0].title),
      subtitle: t("widget.stepperServicesSubtitle", BOOKING_STEP_META[0].subtitle),
      icon: "services",
    },
    {
      title: t("widget.stepperMeetingTitle", BOOKING_STEP_META[1].title),
      subtitle: t("widget.stepperMeetingSubtitle", BOOKING_STEP_META[1].subtitle),
      icon: "meeting",
    },
    {
      title: t("widget.stepperCalendarTitle", BOOKING_STEP_META[2].title),
      subtitle: t("widget.stepperCalendarSubtitle", BOOKING_STEP_META[2].subtitle),
      icon: "calendar",
    },
    {
      title: t("widget.stepperDetailsTitle", BOOKING_STEP_META[3].title),
      subtitle: t("widget.stepperDetailsSubtitle", BOOKING_STEP_META[3].subtitle),
      icon: "user",
    },
    {
      title: t("widget.stepperReviewTitle", BOOKING_STEP_META[4].title),
      subtitle: t("widget.stepperReviewSubtitle", BOOKING_STEP_META[4].subtitle),
      icon: "review",
    },
  ];
}
