import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  BookingState,
  DefaultImages,
  MeetingType,
  Service,
  TimeSlot,
  Translations,
  WidgetSettings,
} from "./types";
import {
  DEFAULT_LABELS,
  INITIAL_STATE,
  MEETING_TYPE_DESCRIPTIONS,
} from "./types";
import {
  detectDefaultPhoneCountryIso,
  getPhoneCountryDial,
} from "./phone-countries";
import { PhoneCountrySelect } from "./PhoneCountrySelect";
import {
  buildCalendarDays,
  clampMonthKey,
  countSelectableDates,
  currentMonthKey,
  formatShortDateLabel,
  isMonthAfter,
  isMonthBefore,
} from "./calendar";
import { DateTimeStep } from "./DateTimeStep";
import {
  formatMerchantDateTimeForZone,
  formatMerchantTimeForZone,
  getUserTimezone,
  todayInTimezone,
} from "./timezone";
import { cn } from "./cn";
import { BOOKING_WIDGET_ROOT_ID } from "./constants";
import { getWidgetTheme, PREVIEW_SERVICES, type WidgetThemeId } from "./theme-styles";
import { StepperHorizontal } from "./StepperHorizontal";
import { StepperVertical } from "./StepperVertical";
import { buildBookingStepMeta } from "./stepper-steps";
import {
  cardImageClass,
  cardImagePlaceholderClass,
} from "./styles";

type MonthAvailability = {
  availableDates: string[];
  unavailableDates: string[];
  closedDates: string[];
  workingHoursSummary?: string;
  calendarBounds?: CalendarBounds;
};

type CalendarBounds = {
  minMonth: string;
  maxMonth: string | null;
  maxAdvanceLabel: string | null;
};

function applyCalendarBounds(
  bounds: CalendarBounds | undefined,
  setCalendarBounds: React.Dispatch<React.SetStateAction<CalendarBounds>>,
  setCurrentMonth: React.Dispatch<React.SetStateAction<string>>,
) {
  if (!bounds) return;
  setCalendarBounds({
    minMonth: bounds.minMonth,
    maxMonth: bounds.maxMonth,
    maxAdvanceLabel: bounds.maxAdvanceLabel,
  });
  setCurrentMonth((month) =>
    clampMonthKey(month, bounds.minMonth, bounds.maxMonth),
  );
}

type Props = {
  shop: string;
  apiBase: string;
  settings: WidgetSettings;
};

function t(labels: Translations, key: string, fallback?: string) {
  return labels[key] ?? DEFAULT_LABELS[key] ?? fallback ?? key;
}

function resolveImage(
  itemUrl: string | null | undefined,
  type: string | undefined,
  defaults: DefaultImages,
) {
  if (itemUrl) return itemUrl;
  if (type === "GOOGLE_MEET" && defaults.ZOOM) return defaults.ZOOM;
  if (type && type !== "CUSTOM" && defaults[type as keyof DefaultImages]) {
    return defaults[type as keyof DefaultImages];
  }
  return "";
}

function meetingDescription(mt: MeetingType) {
  if (mt.description) return mt.description;
  if (mt.type === "CUSTOM") return "";
  return MEETING_TYPE_DESCRIPTIONS[mt.type] || "";
}

function themeText(value: string | undefined, autoSentinel?: string) {
  if (!value) return "";
  if (autoSentinel && value === autoSentinel) return "";
  return value;
}

const STEP3_SUBTITLE_AUTO = "Auto from working hours and closed dates";

function formatPhone(countryIso: string, phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  return `${getPhoneCountryDial(countryIso)} ${trimmed}`;
}

function fetchWithTimeout(url: string, ms: number) {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return fetch(url, { signal: AbortSignal.timeout(ms) });
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => {
    window.clearTimeout(timer);
  });
}

async function readWidgetJsonResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("empty");
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error("html");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("json");
  }
}

function widgetSettingsToLabels(settings: Partial<WidgetSettings>): Translations {
  const labels: Translations = {};
  const set = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) labels[key] = trimmed;
  };

  set("widget.title", settings.title);
  set("widget.subtitle", settings.subtitle);
  set("widget.selectService", settings.step1Title);
  set("widget.step1Subtitle", settings.step1Subtitle);
  set("widget.selectMeetingType", settings.step2Title);
  set("widget.step2Subtitle", settings.step2Subtitle);
  set("widget.step3Intro", settings.step3Intro);
  set("widget.selectDateTime", settings.step3Title);
  set("widget.step3Subtitle", settings.step3Subtitle);
  set("widget.customerInfo", settings.step4Title);
  set("widget.step4Subtitle", settings.step4Subtitle);
  set("widget.review", settings.step5Title);
  set("widget.step5Subtitle", settings.step5Subtitle);
  set("widget.confirm", settings.primaryButtonText);
  set("widget.confirmation", settings.confirmationText);
  set("widget.bookingConfirmed", settings.confirmationText);

  return labels;
}

export function BookingWidget({ shop, apiBase, settings: initialSettings }: Props) {
  const [runtimeSettings, setRuntimeSettings] = useState<WidgetSettings>(initialSettings);
  const [configReady, setConfigReady] = useState(initialSettings.preview === true);
  const [state, setState] = useState<BookingState>(() => ({
    ...INITIAL_STATE,
    phoneCountryIso: detectDefaultPhoneCountryIso(),
  }));
  const [services, setServices] = useState<Service[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [meetingTypesLoading, setMeetingTypesLoading] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [monthData, setMonthData] = useState<MonthAvailability | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState("");
  const [monthNotice, setMonthNotice] = useState("");
  const [calendarBounds, setCalendarBounds] = useState<CalendarBounds>({
    minMonth: currentMonthKey(),
    maxMonth: null,
    maxAdvanceLabel: null,
  });
  const [labels, setLabels] = useState<Translations>(DEFAULT_LABELS);
  const [workingHoursSummary, setWorkingHoursSummary] = useState("");
  const [merchantTimezone, setMerchantTimezone] = useState("UTC");
  const userTimezone = useMemo(() => getUserTimezone(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(currentMonthKey);
  const skipStepScrollRef = useRef(true);
  const mainPanelRef = useRef<HTMLDivElement>(null);

  const isPreview = runtimeSettings.preview === true;
  const [resolvedTheme, setResolvedTheme] = useState<WidgetThemeId>(
    runtimeSettings.theme ?? "classic",
  );
  const theme = getWidgetTheme(runtimeSettings.theme ?? resolvedTheme);
  const isVerticalStepper = theme.stepperVariant === "vertical-sidebar";

  const primary = runtimeSettings.primaryColor || "#0d2e26";
  const accent = runtimeSettings.accentColor || "#f5f0e8";
  const isRtl = runtimeSettings.locale === "ar";
  const defaults = runtimeSettings.defaultImages ?? {};

  const style = {
    "--ab-primary": primary,
    "--ab-accent": accent,
  } as React.CSSProperties;

  const storefrontLocale = runtimeSettings.locale || "en";
  const merchantToday = useMemo(
    () => todayInTimezone(merchantTimezone),
    [merchantTimezone],
  );

  const fetchApi = useCallback(
    async (path: string) => {
      let requestPath = path;
      if (!requestPath.includes("locale=")) {
        const sep = requestPath.includes("?") ? "&" : "?";
        requestPath = `${requestPath}${sep}locale=${encodeURIComponent(storefrontLocale)}`;
      }
      const shopSep = requestPath.includes("?") ? "&" : "?";
      let res: Response;
      try {
        res = await fetchWithTimeout(
          `${apiBase}${requestPath}${shopSep}shop=${encodeURIComponent(shop)}`,
          20000,
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "TimeoutError" || error.name === "AbortError")
        ) {
          throw new Error(DEFAULT_LABELS["widget.errorLoadWidget"]);
        }
        throw error;
      }
      const data = await readWidgetJsonResponse(res);
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : DEFAULT_LABELS["widget.errorRequestFailed"];
        throw new Error(message);
      }
      return data;
    },
    [apiBase, shop, storefrontLocale],
  );

  useEffect(() => {
    if (isPreview) {
      setServices([...PREVIEW_SERVICES]);
      setState((s) => ({ ...s, serviceId: "preview-3", step: 1 }));
      return;
    }

    let cancelled = false;

    async function loadWidgetConfig() {
      const results = await Promise.allSettled([
        fetchApi("/services"),
        fetchApi("/translations"),
        fetchApi("/config"),
      ]);

      if (cancelled) return;

      const [servicesResult, translationsResult, configResult] = results;
      const servicesData =
        servicesResult.status === "fulfilled" ? servicesResult.value : null;
      const translationsData =
        translationsResult.status === "fulfilled" ? translationsResult.value : null;
      const configData =
        configResult.status === "fulfilled" ? configResult.value : null;

      if (!servicesData) {
        setError(t(labels, "widget.errorLoadWidget"));
        setConfigReady(true);
        return;
      }

      setError("");
      setServices((servicesData.services as Service[]) ?? []);

      const translatedLabels = {
        ...DEFAULT_LABELS,
        ...((translationsData?.translations as Translations) ?? {}),
      };
      setLabels(translatedLabels);

      setWorkingHoursSummary(
        typeof configData?.workingHoursSummary === "string"
          ? configData.workingHoursSummary
          : "",
      );
      if (typeof configData?.timezone === "string") {
        setMerchantTimezone(configData.timezone);
      }

      if (configData?.calendarBounds) {
        const bounds = configData.calendarBounds as CalendarBounds;
        setCalendarBounds({
          minMonth: bounds.minMonth ?? currentMonthKey(),
          maxMonth: bounds.maxMonth ?? null,
          maxAdvanceLabel: bounds.maxAdvanceLabel ?? null,
        });
        setCurrentMonth((month) =>
          clampMonthKey(
            month,
            bounds.minMonth ?? currentMonthKey(),
            bounds.maxMonth ?? null,
          ),
        );
      }

      if (configData?.widgetSettings) {
        const widgetSettings = configData.widgetSettings as Partial<WidgetSettings>;
        setRuntimeSettings((prev) => {
          const nextSettings = {
            ...prev,
            ...widgetSettings,
            locale:
              widgetSettings.locale || prev.locale || storefrontLocale,
            visible: widgetSettings.visible !== false,
          };
          setLabels((labelsPrev) => ({
            ...labelsPrev,
            ...widgetSettingsToLabels(nextSettings),
          }));
          return nextSettings;
        });
        if (!initialSettings.theme && widgetSettings.theme) {
          setResolvedTheme(widgetSettings.theme);
        }
      }

      if (!initialSettings.theme) {
        if (configData?.widgetTheme === "MODERN") setResolvedTheme("modern");
        else if (configData?.widgetTheme === "CLASSIC") setResolvedTheme("classic");
      }

      setConfigReady(true);
    }

    loadWidgetConfig().catch(() => {
      if (!cancelled) {
        setError(t(labels, "widget.errorLoadWidget"));
        setConfigReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchApi, isPreview, initialSettings.theme, storefrontLocale]);

  useEffect(() => {
    if (!state.serviceId || isPreview) {
      setMeetingTypes([]);
      setMeetingTypesLoading(false);
      return;
    }

    let cancelled = false;
    setMeetingTypes([]);
    setMeetingTypesLoading(true);
    setState((s) => ({
      ...s,
      meetingTypeId: "",
      date: "",
      startTime: "",
    }));

    fetchApi(`/meeting-types?serviceId=${state.serviceId}`)
      .then((data) => {
        if (cancelled) return;
        const types: MeetingType[] = data.meetingTypes ?? [];
        setMeetingTypes(types);
        if (types.length === 1) {
          setState((s) => ({ ...s, meetingTypeId: types[0].id }));
        }
      })
      .catch(() => {
        if (!cancelled) setMeetingTypes([]);
      })
      .finally(() => {
        if (!cancelled) setMeetingTypesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state.serviceId, fetchApi, isPreview, storefrontLocale]);

  useEffect(() => {
    if (!state.serviceId || isPreview) return;

    let cancelled = false;
    fetchApi(`/config?serviceId=${state.serviceId}`)
      .then((configData) => {
        if (cancelled) return;
        applyCalendarBounds(configData.calendarBounds, setCalendarBounds, setCurrentMonth);
        if (configData.workingHoursSummary) {
          setWorkingHoursSummary(configData.workingHoursSummary);
        }
      })
      .catch(() => {
        /* keep merchant defaults */
      });

    return () => {
      cancelled = true;
    };
  }, [state.serviceId, fetchApi, isPreview]);

  useEffect(() => {
    if (state.step !== 3) return;
    setCurrentMonth((month) =>
      clampMonthKey(month, calendarBounds.minMonth, calendarBounds.maxMonth),
    );
    setMonthNotice("");
    setMonthError("");
  }, [state.step, calendarBounds.minMonth, calendarBounds.maxMonth]);

  function calendarFutureLimitMessage(bounds: CalendarBounds = calendarBounds) {
    const template = t(labels, "widget.calendarFutureLimit");
    if (bounds.maxAdvanceLabel) {
      return template.replace("{range}", bounds.maxAdvanceLabel);
    }
    return t(labels, "widget.calendarFutureLimitGeneric");
  }

  function resolveMonthNotice(
    monthKey: string,
    data: MonthAvailability | null,
    bounds: CalendarBounds = calendarBounds,
    today: string = merchantToday,
  ) {
    if (isMonthBefore(monthKey, bounds.minMonth)) {
      return t(labels, "widget.calendarPastLimit");
    }
    if (bounds.maxMonth && isMonthAfter(monthKey, bounds.maxMonth)) {
      return calendarFutureLimitMessage(bounds);
    }
    if (data && countSelectableDates(monthKey, data, today) === 0) {
      return t(labels, "widget.calendarNoDates");
    }
    return "";
  }

  function handleMonthChange(nextMonth: string) {
    const clamped = clampMonthKey(
      nextMonth,
      calendarBounds.minMonth,
      calendarBounds.maxMonth,
    );

    if (isMonthBefore(nextMonth, calendarBounds.minMonth)) {
      setMonthNotice(t(labels, "widget.calendarPastLimit"));
      setCurrentMonth(calendarBounds.minMonth);
      return;
    }

    if (calendarBounds.maxMonth && isMonthAfter(nextMonth, calendarBounds.maxMonth)) {
      setMonthNotice(calendarFutureLimitMessage());
      setCurrentMonth(calendarBounds.maxMonth);
      return;
    }

    setMonthError("");
    setMonthNotice("");
    setCurrentMonth(clamped);
  }

  useEffect(() => {
    if (!state.serviceId || state.step < 3) return;

    let cancelled = false;
    setMonthLoading(true);
    setMonthError("");

    fetchApi(`/availability?serviceId=${state.serviceId}&month=${currentMonth}`)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.availableDates)) {
          setMonthData(null);
          setMonthError(t(labels, "widget.calendarLoadError"));
          return;
        }
        const nextMonthData: MonthAvailability = {
          availableDates: data.availableDates as string[],
          unavailableDates: (data.unavailableDates as string[]) ?? [],
          closedDates: (data.closedDates as string[]) ?? [],
          workingHoursSummary:
            typeof data.workingHoursSummary === "string"
              ? data.workingHoursSummary
              : undefined,
          calendarBounds: data.calendarBounds as CalendarBounds | undefined,
        };
        setMonthData(nextMonthData);
        const nextBounds = nextMonthData.calendarBounds ?? calendarBounds;
        applyCalendarBounds(nextMonthData.calendarBounds, setCalendarBounds, setCurrentMonth);
        setMonthNotice(
          resolveMonthNotice(currentMonth, nextMonthData, nextBounds, merchantToday),
        );
        if (nextMonthData.workingHoursSummary) {
          setWorkingHoursSummary(nextMonthData.workingHoursSummary);
        }
        if (typeof data.timezone === "string") {
          setMerchantTimezone(data.timezone);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthData(null);
          setMonthError(t(labels, "widget.calendarLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    state.serviceId,
    currentMonth,
    state.step,
    fetchApi,
    labels,
    merchantToday,
  ]);

  useEffect(() => {
    if (!state.serviceId || !state.date) return;
    fetchApi(`/availability?serviceId=${state.serviceId}&date=${state.date}`)
      .then((data) => {
        setSlots(data.slots ?? []);
        if (data.timezone) setMerchantTimezone(data.timezone);
      })
      .catch(() => setSlots([]));
  }, [state.serviceId, state.date, fetchApi, storefrontLocale]);

  useEffect(() => {
    function reportHeight() {
      const shell = document.querySelector(".ab-modern-shell");
      const height = Math.ceil(
        shell instanceof HTMLElement
          ? shell.scrollHeight
          : document.documentElement.scrollHeight,
      );
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "ab-booking-widget-resize", height },
          "*",
        );
      }
    }
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
    const shell = document.querySelector(".ab-modern-shell");
    if (shell instanceof HTMLElement) {
      observer.observe(shell);
    }
    return () => observer.disconnect();
  }, [
    state.step,
    state.serviceId,
    state.meetingTypeId,
    state.date,
    services.length,
    meetingTypes.length,
    meetingTypesLoading,
    slots.length,
    monthData,
    loading,
    error,
    configReady,
  ]);

  useEffect(() => {
    if (skipStepScrollRef.current) {
      skipStepScrollRef.current = false;
      return;
    }

    if (isVerticalStepper && mainPanelRef.current) {
      mainPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "ab-booking-widget-scroll", block: "start" },
          "*",
        );
      }
      return;
    }

    if (window.parent !== window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(BOOKING_WIDGET_ROOT_ID);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.step, isVerticalStepper]);

  const stepMeta = useMemo(
    () => buildBookingStepMeta((key, fallback) => t(labels, key, fallback)),
    [labels],
  );

  const selectedService = services.find((s) => s.id === state.serviceId);
  const calendarDays = buildCalendarDays(currentMonth, monthData, merchantToday);
  const fullPhone = formatPhone(state.phoneCountryIso, state.phone);
  const showLocalTimezoneHint = userTimezone !== merchantTimezone;

  function formatSlotTime(time: string) {
    if (!state.date) return time;
    return formatMerchantTimeForZone(
      state.date,
      time,
      merchantTimezone,
      userTimezone,
      storefrontLocale,
    );
  }

  function formatSelectedDateTime() {
    if (!state.date || !state.startTime) return "";
    return formatMerchantDateTimeForZone(
      state.date,
      state.startTime,
      merchantTimezone,
      userTimezone,
      storefrontLocale,
    );
  }

  async function parseBookingResponse(res: Response) {
    const text = await res.text();
    if (!text) {
      throw new Error(t(labels, "widget.errorEmptyResponse"));
    }

    try {
      return JSON.parse(text) as { booking?: { id: string }; error?: string };
    } catch {
      if (text.trimStart().startsWith("<")) {
        throw new Error(t(labels, "widget.errorUnexpectedPage"));
      }
      throw new Error(t(labels, "widget.errorReadResponse"));
    }
  }

  async function confirmBooking() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/bookings?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          serviceId: state.serviceId,
          meetingTypeId: state.meetingTypeId,
          date: state.date,
          startTime: state.startTime,
          customer: {
            firstName: state.firstName,
            lastName: state.lastName,
            email: state.email,
            phone: fullPhone || undefined,
            note: state.note || undefined,
          },
        }),
      });

      const data = await parseBookingResponse(res);
      if (!res.ok) throw new Error(data.error ?? t(labels, "widget.errorBookingFailed"));
      if (!data.booking?.id) {
        throw new Error(t(labels, "widget.errorIncompleteResponse"));
      }
      setState((s) => ({ ...s, step: 6, bookingId: data.booking!.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, "widget.errorBookingFailed"));
    } finally {
      setLoading(false);
    }
  }

  function canProceed() {
    if (state.step === 1) return !!state.serviceId;
    if (state.step === 2) {
      return (
        !!state.meetingTypeId &&
        meetingTypes.some((mt) => mt.id === state.meetingTypeId)
      );
    }
    if (state.step === 3) return !!state.date && !!state.startTime;
    if (state.step === 4)
      return !!state.firstName && !!state.lastName && !!state.email;
    return true;
  }

  function startNewBooking() {
    setError("");
    setMeetingTypes([]);
    setMeetingTypesLoading(false);
    setSlots([]);
    setMonthData(null);
    setCurrentMonth(currentMonthKey());
    setState({
      ...INITIAL_STATE,
      phoneCountryIso: detectDefaultPhoneCountryIso(),
    });
  }

  if (!configReady && !isPreview) {
    return (
      <div className="ab-booking-widget ab-booking-widget--loading" style={style}>
        <p className="text-sm text-neutral-500">{t(labels, "widget.loading")}</p>
      </div>
    );
  }

  if (runtimeSettings.visible === false && !isPreview) return null;

  const stepHeadings: Record<number, { title: string; subtitle: string }> = {
    1: {
      title: t(labels, "widget.selectService") || runtimeSettings.step1Title || "",
      subtitle:
        t(labels, "widget.step1Subtitle") ||
        runtimeSettings.step1Subtitle ||
        runtimeSettings.subtitle ||
        "",
    },
    2: {
      title: t(labels, "widget.selectMeetingType") || runtimeSettings.step2Title || "",
      subtitle: t(labels, "widget.step2Subtitle") || runtimeSettings.step2Subtitle || "",
    },
    3: {
      title: t(labels, "widget.selectDateTime") || runtimeSettings.step3Title || "",
      subtitle:
        themeText(runtimeSettings.step3Subtitle, STEP3_SUBTITLE_AUTO) ||
        workingHoursSummary ||
        t(labels, "widget.step3Subtitle") ||
        "",
    },
    4: {
      title: t(labels, "widget.customerInfo") || runtimeSettings.step4Title || "",
      subtitle: t(labels, "widget.step4Subtitle") || runtimeSettings.step4Subtitle || "",
    },
    5: {
      title: t(labels, "widget.review") || runtimeSettings.step5Title || "",
      subtitle: t(labels, "widget.step5Subtitle") || runtimeSettings.step5Subtitle || "",
    },
  };

  const step3Intro =
    t(labels, "widget.step3Intro") || runtimeSettings.step3Intro || "";

  const stepContent = (
    <>
      {state.step === 3 && step3Intro && (
        <p
          className={cn(
            "mb-6 text-sm leading-relaxed text-ab-muted",
            isVerticalStepper
              ? "max-w-none text-left"
              : "mx-auto max-w-[640px] text-center",
          )}
        >
          {step3Intro}
        </p>
      )}

      {state.step < 6 && stepHeadings[state.step] && (
        <>
          <h2 className={theme.heading}>
            {stepHeadings[state.step].title}
          </h2>
          {stepHeadings[state.step].subtitle && (
            <p className={theme.subtitle}>
              {stepHeadings[state.step].subtitle}
            </p>
          )}
        </>
      )}

      {error && (
        <div className="mb-4 rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {state.step === 1 && services.length === 0 && (
        <div className="mb-8 rounded-sm border border-ab-border bg-neutral-50 px-4 py-6 text-center">
          <p className="m-0 text-sm text-neutral-700">
            {t(labels, "widget.noServices")}
          </p>
        </div>
      )}

      {state.step === 1 && services.length > 0 && (
        <div className={theme.cardGrid}>
          {services.map((service) => {
            const img = resolveImage(service.imageUrl, undefined, defaults);
            const selected = state.serviceId === service.id;
            return (
              <button
                key={service.id}
                type="button"
                className={theme.serviceCard(selected)}
                onClick={() => setState((s) => ({ ...s, serviceId: service.id }))}
              >
                {img ? (
                  <div className={theme.cardImageWrap}>
                    <img src={img} alt="" className={cardImageClass} />
                  </div>
                ) : (
                  <div className={cardImagePlaceholderClass} />
                )}
                <div className="px-[1.1rem] pb-5 pt-4">
                  <h3 className={theme.cardTitle}>{service.name}</h3>
                  <p className={theme.cardMeta}>
                    {service.durationMinutes} {t(labels, "widget.minutes")}
                  </p>
                  {service.description && (
                    <p className="m-0 text-sm leading-normal text-neutral-700">
                      {service.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {state.step === 2 && (
        <>
          {meetingTypesLoading ? (
            <p className="mb-8 text-center text-sm text-ab-muted">
              {t(labels, "widget.loading")}
            </p>
          ) : meetingTypes.length === 0 ? (
            <div className="mb-8 rounded-sm border border-ab-border bg-neutral-50 px-4 py-6 text-center">
              <p className="m-0 text-sm text-neutral-700">
                {t(labels, "widget.noMeetingTypes")}
              </p>
            </div>
          ) : (
            <div className={theme.cardGrid}>
              {meetingTypes.map((mt) => {
                const img = resolveImage(mt.imageUrl, mt.type, defaults);
                const desc = meetingDescription(mt);
                const selected = state.meetingTypeId === mt.id;
                return (
                  <button
                    key={mt.id}
                    type="button"
                    className={theme.serviceCard(selected)}
                    onClick={() => setState((s) => ({ ...s, meetingTypeId: mt.id }))}
                  >
                    {img ? (
                      <div className={theme.cardImageWrap}>
                        <img src={img} alt="" className={cardImageClass} />
                      </div>
                    ) : (
                      <div className={cardImagePlaceholderClass} />
                    )}
                    <div className="px-[1.1rem] pb-5 pt-4">
                      <h3 className={theme.cardTitle}>{mt.name}</h3>
                      {mt.subtitle && (
                        <p className="mb-2 text-xs text-ab-muted">{mt.subtitle}</p>
                      )}
                      {desc && (
                        <p className="m-0 text-sm leading-normal text-neutral-700">{desc}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {state.step === 3 && (
        <DateTimeStep
          theme={theme}
          labels={labels}
          t={t}
          selectedService={selectedService}
          selectedDate={state.date}
          selectedTime={state.startTime}
          calendarDays={calendarDays}
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          onSelectDate={(date) =>
            setState((s) => ({ ...s, date, startTime: "" }))
          }
          onSelectTime={(startTime) => setState((s) => ({ ...s, startTime }))}
          slots={slots}
          monthLoading={monthLoading}
          monthError={monthError}
          monthNotice={monthNotice}
          minMonth={calendarBounds.minMonth}
          maxMonth={calendarBounds.maxMonth}
          formatSlotTime={formatSlotTime}
          formatSelectedDateLabel={(date) =>
            formatShortDateLabel(date, runtimeSettings.locale)
          }
          merchantTimezone={merchantTimezone}
          userTimezone={userTimezone}
          showLocalTimezoneHint={showLocalTimezoneHint}
          locale={storefrontLocale}
        />
      )}

      {state.step === 4 && (
        <div className="mx-auto mb-8 max-w-[640px]">
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="mb-6">
              <label className={theme.label}>{t(labels, "widget.firstNameLabel")}</label>
              <input
                className={theme.input}
                value={state.firstName}
                placeholder={t(labels, "widget.firstNamePlaceholder")}
                onChange={(e) =>
                  setState((s) => ({ ...s, firstName: e.target.value }))
                }
              />
            </div>
            <div className="mb-6">
              <label className={theme.label}>{t(labels, "widget.lastNameLabel")}</label>
              <input
                className={theme.input}
                value={state.lastName}
                placeholder={t(labels, "widget.lastNamePlaceholder")}
                onChange={(e) =>
                  setState((s) => ({ ...s, lastName: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="mb-6">
            <label className={theme.label}>{t(labels, "widget.emailLabel")}</label>
            <input
              type="email"
              className={theme.input}
              value={state.email}
              placeholder={t(labels, "widget.emailPlaceholder")}
              onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="mb-6">
            <label className={theme.label}>{t(labels, "widget.phone")} *</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-[min(100%,13.5rem)] sm:shrink-0">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {t(labels, "widget.countryCode")}
                </span>
                <PhoneCountrySelect
                  value={state.phoneCountryIso}
                  onChange={(phoneCountryIso) =>
                    setState((s) => ({ ...s, phoneCountryIso }))
                  }
                  className={theme.phoneCountrySelect}
                  ariaLabel={t(labels, "widget.countryCodeAria")}
                  popularLabel={t(labels, "widget.popularCountries")}
                  allCountriesLabel={t(labels, "widget.allCountries")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {t(labels, "widget.phoneNumber")}
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className={theme.input}
                  value={state.phone}
                  placeholder={t(labels, "widget.phonePlaceholder")}
                  onChange={(e) =>
                    setState((s) => ({ ...s, phone: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className={theme.label}>{t(labels, "widget.note")}</label>
            <textarea
              rows={4}
              className={cn(theme.input, "min-h-[100px] resize-y")}
              value={state.note}
              placeholder={t(labels, "widget.notePlaceholder")}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
            />
          </div>
        </div>
      )}

      {state.step === 5 && (
        <div className="mb-8 grid grid-cols-1 border-t border-ab-border sm:grid-cols-2">
          <div className="border-b border-ab-border py-5">
            <div className={theme.reviewLabel}>{t(labels, "widget.reviewAppointment")}</div>
            <div className="text-[0.95rem] leading-normal">{selectedService?.name}</div>
          </div>
          <div className="border-b border-ab-border py-5">
            <div className={theme.reviewLabel}>{t(labels, "widget.reviewDateTime")}</div>
            <div className="text-[0.95rem] leading-normal">{formatSelectedDateTime()}</div>
          </div>
          <div className="border-b border-ab-border py-5">
            <div className={theme.reviewLabel}>{t(labels, "widget.reviewFullName")}</div>
            <div className="text-[0.95rem] leading-normal">
              {state.firstName} {state.lastName}
            </div>
          </div>
          <div className="border-b border-ab-border py-5">
            <div className={theme.reviewLabel}>{t(labels, "widget.reviewEmail")}</div>
            <div className="text-[0.95rem] leading-normal">{state.email}</div>
          </div>
          {fullPhone && (
            <div className="border-b border-ab-border py-5">
              <div className={theme.reviewLabel}>
                {t(labels, "widget.phone")}
              </div>
              <div className="text-[0.95rem] leading-normal">{fullPhone}</div>
            </div>
          )}
          {state.note && (
            <div className="col-span-full border-b border-ab-border py-5">
              <div className={theme.reviewLabel}>{t(labels, "widget.reviewNote")}</div>
              <div className="text-[0.95rem] leading-normal">{state.note}</div>
            </div>
          )}
        </div>
      )}

      {state.step === 6 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-ab-accent text-[1.75rem] text-ab-check">
            ✓
          </div>
          <h2 className={theme.heading}>
            {runtimeSettings.confirmationText || t(labels, "widget.bookingConfirmed")}
          </h2>
          <p className={theme.subtitle}>
            {selectedService?.name} · {formatSelectedDateTime()}
          </p>
          {!isPreview && (
            <button
              type="button"
              className={cn(theme.primaryButton, "mt-6")}
              onClick={startNewBooking}
            >
              {t(labels, "widget.bookAnother")}
            </button>
          )}
        </div>
      )}

      {state.step < 6 && !isPreview && (
        <div
          className={cn(
            "mt-6 flex gap-3",
            isVerticalStepper
              ? state.step > 1
                ? "justify-between"
                : "justify-end"
              : "justify-end",
          )}
        >
          {state.step > 1 && (
            <button
              type="button"
              className={theme.secondaryButton}
              onClick={() => setState((s) => ({ ...s, step: s.step - 1 }))}
            >
              {t(labels, "widget.back")}
            </button>
          )}
          {state.step < 5 ? (
            <button
              type="button"
              className={theme.primaryButton}
              disabled={!canProceed()}
              onClick={() => setState((s) => ({ ...s, step: s.step + 1 }))}
            >
              {t(labels, "widget.next")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={theme.secondaryButton}
                onClick={() => setState((s) => ({ ...s, step: 1 }))}
              >
                {t(labels, "widget.cancel")}
              </button>
              <button
                type="button"
                className={theme.primaryButton}
                disabled={loading}
                onClick={confirmBooking}
              >
                {loading
                  ? t(labels, "widget.confirming")
                  : runtimeSettings.primaryButtonText || t(labels, "widget.confirm")}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(theme.widgetRoot, theme.id === "modern" && "ab-theme-modern")}
      dir={isRtl ? "rtl" : "ltr"}
      style={style}
      data-ab-theme={theme.id}
    >
      {state.step < 6 && isVerticalStepper ? (
        <div className={theme.shellLayout}>
          <StepperVertical
            current={state.step}
            total={5}
            theme={theme}
            stepsMeta={stepMeta}
            ariaLabel={t(labels, "widget.stepperAriaLabel")}
          />
          <div
            ref={mainPanelRef}
            id="ab-booking-main-panel"
            className={theme.mainPanel}
          >
            <div className={theme.stepBadge}>
              {t(labels, "widget.stepProgress")
                .replace("{step}", String(state.step))
                .replace("{total}", "5")}
            </div>
            {stepContent}
          </div>
        </div>
      ) : (
        <>
          {state.step < 6 && (
            <StepperHorizontal
              current={state.step}
              total={5}
              theme={theme}
              ariaLabel={t(labels, "widget.stepperAriaLabel")}
            />
          )}
          {stepContent}
        </>
      )}

      {isPreview && (
        <p className="mt-4 text-center text-xs text-ab-muted">
          {t(labels, "widget.previewBanner")}
        </p>
      )}
    </div>
  );
}
