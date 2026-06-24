import { cn } from "./cn";

export type WidgetThemeId = "classic" | "modern";
export type StepperVariant = "horizontal" | "vertical-sidebar";
type StepState = "done" | "active" | "upcoming";

export type WidgetThemeStyles = {
  id: WidgetThemeId;
  stepperVariant: StepperVariant;
  shellLayout: string;
  mainPanel: string;
  stepBadge: string;
  stepperWrap: string;
  stepperSidebar: string;
  widgetRoot: string;
  serviceCard: (selected: boolean) => string;
  cardImageWrap: string;
  cardGrid: string;
  cardTitle: string;
  cardMeta: string;
  stepCircle: (state: StepState) => string;
  stepConnector: string;
  stepConnectorVertical: string;
  stepLabelTitle: (state: StepState) => string;
  stepLabelSubtitle: (state: StepState) => string;
  heading: string;
  subtitle: string;
  label: string;
  input: string;
  phoneCountrySelect: string;
  primaryButton: string;
  secondaryButton: string;
  reviewLabel: string;
};

const CLASSIC: WidgetThemeStyles = {
  id: "classic",
  stepperVariant: "horizontal",
  shellLayout: "",
  mainPanel: "",
  stepBadge: "",
  stepperWrap: "overflow-visible",
  stepperSidebar: "",
  widgetRoot:
    "mx-auto w-full max-w-widget bg-transparent px-4 py-8 pb-12 font-sans text-neutral-900 sm:px-6",
  serviceCard: (selected) =>
    cn(
      "group w-full appearance-none overflow-hidden rounded-sm border-2 border-[#e8e4dc] bg-transparent p-0 text-left",
      "transition-all duration-200 ease-out",
      "hover:border-[var(--ab-primary)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
      "active:scale-[0.99] active:shadow-sm",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ab-primary)]",
      selected &&
        "border-[var(--ab-primary)] bg-transparent shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
    ),
  cardImageWrap: "flex items-center justify-center bg-[#f7f5f2] px-4 py-3",
  cardGrid: "mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3",
  cardTitle: "mb-1 font-serif text-[1.35rem] font-semibold",
  cardMeta: "mb-2 text-xs text-ab-muted",
  stepCircle: (state) =>
    cn(
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
      state === "upcoming" && "border-[#e8e4dc] bg-white text-[#6b6b6b]",
      state === "done" &&
        "border-[var(--ab-accent)] bg-[var(--ab-accent)] font-semibold text-[#9a7b4f]",
      state === "active" &&
        "border-[var(--ab-primary)] bg-[var(--ab-primary)] text-white",
    ),
  stepConnector: "mx-1.5 h-px min-w-[12px] flex-1 bg-[#e8e4dc]",
  stepConnectorVertical: "hidden",
  stepLabelTitle: () => "hidden",
  stepLabelSubtitle: () => "hidden",
  heading: "mb-2 text-center font-serif text-[2rem] font-medium leading-tight",
  subtitle:
    "mx-auto mb-8 max-w-[560px] text-center text-[0.95rem] leading-normal text-ab-muted",
  label: "mb-2 block font-serif text-base",
  input:
    "w-full border-0 border-b border-[#e8e4dc] bg-transparent py-2.5 text-sm outline-none font-[inherit] focus:border-b-[var(--ab-primary)]",
  phoneCountrySelect:
    "w-full appearance-none border-0 border-b border-[#e8e4dc] bg-transparent py-2.5 text-sm outline-none font-[inherit] focus:border-b-[var(--ab-primary)]",
  primaryButton:
    "cursor-pointer rounded-sm border-0 bg-[var(--ab-primary)] px-8 py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "cursor-pointer rounded-sm border-0 bg-neutral-200 px-8 py-3 text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  reviewLabel: "mb-1.5 font-serif text-base text-ab-muted",
};

const MODERN: WidgetThemeStyles = {
  id: "modern",
  stepperVariant: "vertical-sidebar",
  shellLayout:
    "ab-modern-shell grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] md:gap-8",
  mainPanel:
    "ab-modern-main min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 md:p-8",
  stepBadge:
    "mb-5 inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-600",
  stepperWrap: "",
  stepperSidebar:
    "ab-modern-sidebar rounded-2xl bg-neutral-900 px-4 py-5 text-white shadow-lg sm:px-5 sm:py-6",
  widgetRoot:
    "mx-auto w-full max-w-[960px] bg-transparent px-4 py-8 pb-12 font-sans text-neutral-900 sm:px-6",
  serviceCard: (selected) =>
    cn(
      "group w-full appearance-none overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 text-left shadow-sm",
      "transition-all duration-200 ease-out",
      "hover:-translate-y-0.5 hover:border-[var(--ab-primary)] hover:shadow-md",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ab-primary)]",
      selected &&
        "border-[var(--ab-primary)] bg-[color-mix(in_srgb,var(--ab-primary)_6%,white)] shadow-md ring-2 ring-[var(--ab-primary)] ring-offset-2",
    ),
  cardImageWrap:
    "flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 px-4 py-4",
  cardGrid: "mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2",
  cardTitle: "mb-1 text-lg font-bold tracking-tight text-neutral-900",
  cardMeta: "mb-2 text-xs font-medium uppercase tracking-wide text-ab-muted",
  stepCircle: (state) =>
    cn(
      "relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
      state === "upcoming" &&
        "border-neutral-600 bg-neutral-800 text-neutral-400",
      state === "done" &&
        "border-[var(--ab-primary)] bg-[var(--ab-primary)] text-white",
      state === "active" &&
        "border-[var(--ab-primary)] bg-[var(--ab-primary)] text-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--ab-primary)_35%,transparent)]",
    ),
  stepConnector: "hidden",
  stepConnectorVertical:
    "my-1 min-h-[28px] w-0.5 flex-1 rounded-full bg-neutral-700",
  stepLabelTitle: (state) =>
    cn(
      "text-sm font-bold leading-tight",
      state === "active" && "text-white",
      state === "done" && "text-neutral-300",
      state === "upcoming" && "text-neutral-500",
    ),
  stepLabelSubtitle: (state) =>
    cn(
      "mt-0.5 text-xs leading-snug",
      state === "active" && "text-neutral-300",
      state === "done" && "text-neutral-500",
      state === "upcoming" && "text-neutral-600",
    ),
  heading: "mb-2 text-left text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl",
  subtitle: "mb-8 max-w-none text-left text-base leading-relaxed text-ab-muted",
  label: "mb-2 block text-sm font-semibold uppercase tracking-wide text-neutral-600",
  input:
    "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none font-[inherit] transition-colors focus:border-[var(--ab-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ab-primary)_18%,transparent)]",
  phoneCountrySelect:
    "w-full appearance-none rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none font-[inherit] transition-colors focus:border-[var(--ab-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ab-primary)_18%,transparent)]",
  primaryButton:
    "cursor-pointer rounded-full border-0 bg-[var(--ab-primary)] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
  secondaryButton:
    "cursor-pointer rounded-full border border-neutral-200 bg-white px-8 py-3 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50",
  reviewLabel: "mb-1.5 text-xs font-semibold uppercase tracking-wide text-ab-muted",
};

export function getWidgetTheme(theme?: string | null): WidgetThemeStyles {
  return theme === "modern" ? MODERN : CLASSIC;
}

export const PREVIEW_SERVICES = [
  {
    id: "preview-1",
    name: "Browse the collection",
    description: "See our pieces in person and get styling advice.",
    imageUrl: null,
    durationMinutes: 45,
    meetingTypeIds: [] as string[],
  },
  {
    id: "preview-2",
    name: "Custom design",
    description: "Work with our team on a bespoke piece.",
    imageUrl: null,
    durationMinutes: 40,
    meetingTypeIds: [] as string[],
  },
  {
    id: "preview-3",
    name: "Engagement ring",
    description: "Private consultation for your perfect ring.",
    imageUrl: null,
    durationMinutes: 40,
    meetingTypeIds: [] as string[],
  },
];
