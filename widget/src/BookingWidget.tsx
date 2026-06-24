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
  countSelectableDates,
  currentMonthKey,
  formatMonthLabel,
  shiftMonth,
} from "./calendar";
import {
  formatMerchantDateTimeForZone,
  formatMerchantTimeForZone,
  formatTimezoneShort,
  getUserTimezone,
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
};

type Props = {
  shop: string;
  apiBase: string;
  settings: WidgetSettings;
};

function t(labels: Translations, key: string, fallback?: string) {
  return labels[key] ?? DEFAULT_LABELS[key] ?? fallback ?? key;
}

function interpolateLabel(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
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
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [monthData, setMonthData] = useState<MonthAvailability | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState("");
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

  const fetchApi = useCallback(
    async (path: string) => {
      const sep = path.includes("?") ? "&" : "?";
      const res = await fetch(`${apiBase}${path}${sep}shop=${encodeURIComponent(shop)}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    [apiBase, shop],
  );

  useEffect(() => {
    if (isPreview) {
      setServices([...PREVIEW_SERVICES]);
      setState((s) => ({ ...s, serviceId: "preview-3", step: 1 }));
      return;
    }
    fetchApi("/services")
      .then((data) => setServices(data.services ?? []))
      .catch(() => setError("Failed to load services"));
    fetchApi(`/translations?locale=${encodeURIComponent(runtimeSettings.locale)}`)
      .then((data) =>
        setLabels({ ...DEFAULT_LABELS, ...(data.translations ?? {}) }),
      )
      .catch(() => {});
    fetchApi(`/config?locale=${encodeURIComponent(runtimeSettings.locale)}`)
      .then((data) => {
        setWorkingHoursSummary(data.workingHoursSummary ?? "");
        setMerchantTimezone(data.timezone ?? "UTC");
        if (data.widgetSettings) {
          setRuntimeSettings((prev) => {
            const nextSettings = {
              ...prev,
              ...data.widgetSettings,
              locale: data.widgetSettings.locale || prev.locale || "en",
              visible: data.widgetSettings.visible !== false,
            };
            setLabels((labelsPrev) => ({
              ...labelsPrev,
              ...widgetSettingsToLabels(nextSettings),
            }));
            return nextSettings;
          });
          if (!initialSettings.theme && data.widgetSettings.theme) {
            setResolvedTheme(data.widgetSettings.theme);
          }
        }
        if (!initialSettings.theme) {
          if (data.widgetTheme === "MODERN") setResolvedTheme("modern");
          else if (data.widgetTheme === "CLASSIC") setResolvedTheme("classic");
        }
        setConfigReady(true);
      })
      .catch(() => setConfigReady(true));
  }, [fetchApi, runtimeSettings.locale, isPreview, initialSettings.theme]);

  useEffect(() => {
    if (!state.serviceId || isPreview) return;
    fetchApi(`/meeting-types?serviceId=${state.serviceId}`)
      .then((data) => setMeetingTypes(data.meetingTypes ?? []))
      .catch(() => setMeetingTypes([]));
  }, [state.serviceId, fetchApi, isPreview]);

  useEffect(() => {
    if (state.step !== 3) return;
    setCurrentMonth((month) => {
      const todayMonth = currentMonthKey();
      return month < todayMonth ? todayMonth : month;
    });
  }, [state.step]);

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
          setMonthError("Could not load availability");
          return;
        }
        setMonthData({
          availableDates: data.availableDates,
          unavailableDates: data.unavailableDates ?? [],
          closedDates: data.closedDates ?? [],
          workingHoursSummary: data.workingHoursSummary,
        });
        if (data.workingHoursSummary) {
          setWorkingHoursSummary(data.workingHoursSummary);
        }
        if (data.timezone) {
          setMerchantTimezone(data.timezone);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthData(null);
          setMonthError("Could not load availability");
        }
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state.serviceId, currentMonth, state.step, fetchApi]);

  useEffect(() => {
    if (monthLoading || !monthData || monthError || state.step < 3) return;
    if (countSelectableDates(currentMonth, monthData) > 0) return;

    const todayMonth = currentMonthKey();
    if (currentMonth < todayMonth) {
      setCurrentMonth(todayMonth);
      return;
    }

    const [ty, tm] = todayMonth.split("-").map(Number);
    const [cy, cm] = currentMonth.split("-").map(Number);
    const monthDiff = (cy - ty) * 12 + (cm - tm);
    if (monthDiff >= 12) return;

    setCurrentMonth((month) => shiftMonth(month, 1));
  }, [monthData, monthLoading, monthError, currentMonth, state.step]);

  useEffect(() => {
    if (!state.serviceId || !state.date) return;
    fetchApi(`/availability?serviceId=${state.serviceId}&date=${state.date}`)
      .then((data) => {
        setSlots(data.slots ?? []);
        if (data.timezone) setMerchantTimezone(data.timezone);
      })
      .catch(() => setSlots([]));
  }, [state.serviceId, state.date, fetchApi]);

  useEffect(() => {
    function reportHeight() {
      const height = Math.ceil(document.documentElement.scrollHeight);
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
    return () => observer.disconnect();
  }, [
    state.step,
    state.serviceId,
    state.meetingTypeId,
    state.date,
    services.length,
    meetingTypes.length,
    slots.length,
    monthData,
    loading,
    error,
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
  const calendarDays = buildCalendarDays(currentMonth, monthData);
  const fullPhone = formatPhone(state.phoneCountryIso, state.phone);
  const showLocalTimezoneHint = userTimezone !== merchantTimezone;

  function formatSlotTime(time: string) {
    if (!state.date) return time;
    return formatMerchantTimeForZone(
      state.date,
      time,
      merchantTimezone,
      userTimezone,
    );
  }

  function formatSelectedDateTime() {
    if (!state.date || !state.startTime) return "";
    return formatMerchantDateTimeForZone(
      state.date,
      state.startTime,
      merchantTimezone,
      userTimezone,
    );
  }

  async function parseBookingResponse(res: Response) {
    const text = await res.text();
    if (!text) {
      throw new Error("Empty response from booking server");
    }

    try {
      return JSON.parse(text) as { booking?: { id: string }; error?: string };
    } catch {
      if (text.trimStart().startsWith("<")) {
        throw new Error(
          "Booking server returned an unexpected page instead of JSON. Try again in a moment.",
        );
      }
      throw new Error(
        "Could not read the confirmation response. If you received an email, your booking was likely created.",
      );
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
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      if (!data.booking?.id) throw new Error("Booking response was incomplete");
      setState((s) => ({ ...s, step: 6, bookingId: data.booking!.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  function canProceed() {
    if (state.step === 1) return !!state.serviceId;
    if (state.step === 2) return !!state.meetingTypeId;
    if (state.step === 3) return !!state.date && !!state.startTime;
    if (state.step === 4)
      return !!state.firstName && !!state.lastName && !!state.email;
    return true;
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
      title: runtimeSettings.step1Title || t(labels, "widget.selectService"),
      subtitle:
        runtimeSettings.step1Subtitle ||
        t(labels, "widget.step1Subtitle") ||
        runtimeSettings.subtitle,
    },
    2: {
      title: runtimeSettings.step2Title || t(labels, "widget.selectMeetingType"),
      subtitle: runtimeSettings.step2Subtitle || t(labels, "widget.step2Subtitle") || "",
    },
    3: {
      title: runtimeSettings.step3Title || t(labels, "widget.selectDateTime"),
      subtitle:
        themeText(runtimeSettings.step3Subtitle, STEP3_SUBTITLE_AUTO) ||
        workingHoursSummary ||
        "",
    },
    4: {
      title: runtimeSettings.step4Title || t(labels, "widget.customerInfo"),
      subtitle: runtimeSettings.step4Subtitle || t(labels, "widget.step4Subtitle") || "",
    },
    5: {
      title: runtimeSettings.step5Title || t(labels, "widget.review"),
      subtitle: runtimeSettings.step5Subtitle || t(labels, "widget.step5Subtitle") || "",
    },
  };

  const step3Intro =
    runtimeSettings.step3Intro || t(labels, "widget.step3Intro") || "";

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

      {state.step === 1 && (
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

      {state.step === 3 && (
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <div
              className={cn(
                "mb-4 flex items-center justify-between text-xl",
                theme.id === "classic" ? "font-serif" : "font-bold tracking-tight",
              )}
            >
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent px-2 py-1 text-xl text-ab-muted"
                onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span>{formatMonthLabel(currentMonth)}</span>
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent px-2 py-1 text-xl text-ab-muted"
                onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-ab-muted">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, i) => (
                <button
                  key={cell.date || `pad-${i}`}
                  type="button"
                  disabled={cell.status !== "available" || monthLoading}
                  className={cn(
                    "aspect-square rounded-sm border-0 bg-transparent text-sm",
                    !cell.inMonth && "cursor-default text-neutral-300",
                    cell.inMonth && cell.status === "available" &&
                      "cursor-pointer text-neutral-900 hover:bg-neutral-100",
                    cell.inMonth && cell.status === "past" &&
                      "cursor-not-allowed text-neutral-300",
                    cell.inMonth &&
                      cell.status !== "available" &&
                      cell.status !== "past" &&
                      "cursor-default text-neutral-300",
                    state.date === cell.date && "!bg-[var(--ab-accent)]",
                  )}
                  onClick={() =>
                    setState((s) => ({ ...s, date: cell.date, startTime: "" }))
                  }
                >
                  {cell.day}
                </button>
              ))}
            </div>
            {monthLoading && (
              <p className="mt-2 text-xs text-ab-muted">
                {t(labels, "widget.loadingAvailability")}
              </p>
            )}
            {monthError && !monthLoading && (
              <p className="mt-2 text-xs text-ab-muted">{monthError}</p>
            )}
          </div>
          <div>
            <h4
              className={cn(
                "mb-4 text-lg",
                theme.id === "classic" ? "font-serif" : "font-bold tracking-tight",
              )}
            >
              {t(labels, "widget.availableTimes")}
            </h4>
            {showLocalTimezoneHint && (
              <p className="mb-2 text-xs text-ab-muted">
                {interpolateLabel(t(labels, "widget.timezoneHint"), {
                  timezone: formatTimezoneShort(userTimezone),
                })}
              </p>
            )}
            {!state.date ? (
              <p className="text-xs text-ab-muted">{t(labels, "widget.selectDateFirst")}</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-ab-muted">{t(labels, "widget.noSlots")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    className={cn(
                      "cursor-pointer rounded-sm border-0 bg-neutral-100 px-2 py-2.5 text-sm transition-all duration-150",
                      "hover:bg-neutral-200 hover:shadow-sm",
                      state.startTime === slot.startTime &&
                        "bg-transparent shadow-sm ring-2 ring-[var(--ab-primary)]",
                    )}
                    onClick={() =>
                      setState((s) => ({ ...s, startTime: slot.startTime }))
                    }
                  >
                    {formatSlotTime(slot.startTime)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
          />
          <div
            ref={mainPanelRef}
            id="ab-booking-main-panel"
            className={theme.mainPanel}
          >
            <div className={theme.stepBadge}>
              Step {state.step}/5
            </div>
            {stepContent}
          </div>
        </div>
      ) : (
        <>
          {state.step < 6 && (
            <StepperHorizontal current={state.step} total={5} theme={theme} />
          )}
          {stepContent}
        </>
      )}

      {isPreview && (
        <p className="mt-4 text-center text-xs text-ab-muted">
          Storefront preview — sample services shown for appearance only.
        </p>
      )}
    </div>
  );
}
