export type DefaultImages = {
  ZOOM?: string;
  PHONE?: string;
  WHATSAPP?: string;
  IN_STORE?: string;
};

export type StorefrontConfig = {
  workingHoursSummary: string;
  timezone: string;
  widgetTheme?: string;
  widgetSettings?: Partial<WidgetSettings>;
};

export type WidgetSettings = {
  title: string;
  subtitle: string;
  step1Title: string;
  step1Subtitle: string;
  step2Title: string;
  step2Subtitle: string;
  step3Intro: string;
  step3Title: string;
  step3Subtitle: string;
  step4Title: string;
  step4Subtitle: string;
  step5Title: string;
  step5Subtitle: string;
  primaryButtonText: string;
  confirmationText: string;
  primaryColor: string;
  accentColor: string;
  visible: boolean;
  locale: string;
  theme?: "classic" | "modern";
  preview?: boolean;
  defaultImages: DefaultImages;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  meetingTypeIds: string[];
};

export type MeetingType = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  imageUrl: string | null;
};

export type TimeSlot = { startTime: string; endTime: string };

export type Translations = Record<string, string>;

export type BookingState = {
  step: number;
  serviceId: string;
  meetingTypeId: string;
  date: string;
  startTime: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryIso: string;
  phone: string;
  note: string;
  bookingId: string;
};

export const INITIAL_STATE: BookingState = {
  step: 1,
  serviceId: "",
  meetingTypeId: "",
  date: "",
  startTime: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneCountryIso: "US",
  phone: "",
  note: "",
  bookingId: "",
};

export const DEFAULT_LABELS: Translations = {
  "widget.selectService": "What brings you in?",
  "widget.selectMeetingType": "How would you like to meet?",
  "widget.selectDateTime": "Choose a date and time",
  "widget.step1Subtitle": "Select the type of appointment.",
  "widget.step2Subtitle": "Choose what works best for you.",
  "widget.step3Intro": "",
  "widget.step4Subtitle":
    "We'll send a confirmation to your email. WhatsApp reminders available if you add your number.",
  "widget.step5Subtitle":
    "Check the details below before confirming. You'll receive a confirmation email immediately.",
  "widget.customerInfo": "Your details",
  "widget.review": "Review your appointment",
  "widget.confirm": "Confirm appointment",
  "widget.confirmation": "You're all set!",
  "widget.firstNameLabel": "Enter your first name *",
  "widget.firstNamePlaceholder": "Enter your first name",
  "widget.lastNameLabel": "Enter your last name *",
  "widget.lastNamePlaceholder": "Enter your last name",
  "widget.emailLabel": "Enter your email *",
  "widget.emailPlaceholder": "Enter your email",
  "widget.phone": "Phone Number / WhatsApp",
  "widget.phoneNumber": "Phone number",
  "widget.countryCode": "Country / region",
  "widget.phonePlaceholder": "555 123 4567",
  "widget.note": "Anything we should know? (optional)",
  "widget.notePlaceholder":
    "Tell us about your idea, budget, or any questions you have in advance.",
  "widget.next": "Next",
  "widget.back": "Back",
  "widget.cancel": "Cancel",
  "widget.confirming": "Confirming…",
  "widget.noSlots": "No available time slot",
  "widget.bookingConfirmed": "Your appointment has been confirmed.",
  "widget.minutes": "minutes",
  "widget.availableTimes": "Available Times",
  "widget.timezoneHint": "Times shown in your timezone ({timezone})",
  "widget.selectDateFirst": "Select a date first",
  "widget.loading": "Loading…",
  "widget.loadingAvailability": "Loading availability…",
  "widget.reviewAppointment": "Appointment",
  "widget.reviewDateTime": "Date and time",
  "widget.reviewFullName": "Full Name",
  "widget.reviewEmail": "Email address",
  "widget.reviewNote": "Note",
  "widget.stepperServicesTitle": "Services",
  "widget.stepperServicesSubtitle": "Choose a service",
  "widget.stepperMeetingTitle": "Meeting type",
  "widget.stepperMeetingSubtitle": "How to meet",
  "widget.stepperCalendarTitle": "Date & time",
  "widget.stepperCalendarSubtitle": "Pick a slot",
  "widget.stepperDetailsTitle": "Your details",
  "widget.stepperDetailsSubtitle": "Contact information",
  "widget.stepperReviewTitle": "Review",
  "widget.stepperReviewSubtitle": "Confirm booking",
};

export const MEETING_TYPE_DESCRIPTIONS: Record<string, string> = {
  ZOOM: "Video call with a Zoom link sent after booking.",
  GOOGLE_MEET: "Video call with a Google Meet link sent after booking.",
  PHONE: "Quick call. Good for briefs, questions, and pricing.",
  WHATSAPP: "Quick call. Good for briefs, questions, and pricing.",
  IN_STORE: "Private visit at our showroom.",
};
