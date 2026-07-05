import type { CalendarDay } from "./calendar";
import { formatMonthLabel, getWeekdayHeaders, isMonthAfter, isMonthBefore, shiftMonth } from "./calendar";
import type { Service, TimeSlot, Translations } from "./types";
import type { WidgetThemeStyles } from "./theme-styles";
import { cn } from "./cn";

type Props = {
  theme: WidgetThemeStyles;
  labels: Translations;
  t: (labels: Translations, key: string, fallback?: string) => string;
  selectedService?: Service;
  selectedDate: string;
  selectedTime: string;
  calendarDays: CalendarDay[];
  currentMonth: string;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  slots: TimeSlot[];
  monthLoading: boolean;
  monthError: string;
  monthNotice: string;
  minMonth: string;
  maxMonth: string | null;
  formatSlotTime: (time: string) => string;
  formatSelectedDateLabel: (date: string) => string;
  merchantTimezone: string;
  userTimezone: string;
  showLocalTimezoneHint: boolean;
  locale: string;
};

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 12h16M12 4c2.5 2.8 3.8 6 3.8 9s-1.3 6.2-3.8 9M12 4c-2.5 2.8-3.8 6-3.8 9s1.3 6.2 3.8 9"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function formatTimezoneLabel(timeZone: string, locale?: string) {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return `${timeZone.replace(/_/g, " ")}${offset ? ` (${offset})` : ""}`;
  } catch {
    return timeZone;
  }
}

export function DateTimeStep({
  theme,
  labels,
  t,
  selectedService,
  selectedDate,
  selectedTime,
  calendarDays,
  currentMonth,
  onMonthChange,
  onSelectDate,
  onSelectTime,
  slots,
  monthLoading,
  monthError,
  monthNotice,
  minMonth,
  maxMonth,
  formatSlotTime,
  formatSelectedDateLabel,
  merchantTimezone,
  userTimezone,
  showLocalTimezoneHint,
  locale,
}: Props) {
  const isModern = theme.id === "modern";
  const displayTimezone = showLocalTimezoneHint ? userTimezone : merchantTimezone;
  const canGoPrev = !isMonthBefore(currentMonth, minMonth);
  const canGoNext = !maxMonth || !isMonthAfter(currentMonth, maxMonth);
  const weekdayHeaders = getWeekdayHeaders(locale);

  return (
    <div
      className={cn(
        "ab-datetime mb-8",
        isModern ? "ab-datetime--modern" : "ab-datetime--classic",
      )}
    >
      <div className="ab-datetime__panel">
        {isModern && selectedService && (
          <aside className="ab-datetime__summary">
            <h3 className="ab-datetime__summary-title">{selectedService.name}</h3>
            <ul className="ab-datetime__summary-list">
              <li className="ab-datetime__summary-item">
                <IconClock />
                <span>
                  {selectedService.durationMinutes} {t(labels, "widget.minutes")}
                </span>
              </li>
              <li className="ab-datetime__summary-item">
                <IconCalendar />
                <span>
                  {selectedDate
                    ? formatSelectedDateLabel(selectedDate)
                    : t(labels, "widget.selectDateFirst")}
                </span>
              </li>
            </ul>
          </aside>
        )}

        <div className="ab-datetime__calendar">
          <div className="ab-datetime__month-nav">
            <button
              type="button"
              className="ab-datetime__month-btn"
              disabled={!canGoPrev || monthLoading}
              onClick={() => onMonthChange(shiftMonth(currentMonth, -1))}
              aria-label={t(labels, "widget.previousMonth")}
            >
              ‹
            </button>
            <span className="ab-datetime__month-label">
              {formatMonthLabel(currentMonth, locale)}
            </span>
            <button
              type="button"
              className="ab-datetime__month-btn"
              disabled={!canGoNext || monthLoading}
              onClick={() => onMonthChange(shiftMonth(currentMonth, 1))}
              aria-label={t(labels, "widget.nextMonth")}
            >
              ›
            </button>
          </div>

          {(monthNotice || monthError) && (
            <p
              className={cn(
                "ab-datetime__status",
                monthError ? "ab-datetime__status--error" : "ab-datetime__status--notice",
              )}
            >
              {monthError || monthNotice}
            </p>
          )}

          <div className="ab-datetime__weekdays">
            {weekdayHeaders.map((day) => (
              <span key={day} className="ab-datetime__weekday">
                {day}
              </span>
            ))}
          </div>

          <div className="ab-datetime__days">
            {calendarDays.map((cell, index) => {
              const isSelected =
                cell.inMonth && Boolean(cell.date) && selectedDate === cell.date;
              const isAvailable = cell.inMonth && cell.status === "available";
              return (
                <button
                  key={cell.date || `pad-${index}`}
                  type="button"
                  disabled={!isAvailable || monthLoading}
                  className={cn(
                    "ab-datetime__day",
                    !cell.inMonth && "ab-datetime__day--outside",
                    cell.inMonth && cell.status === "past" && "ab-datetime__day--past",
                    cell.inMonth &&
                      !isAvailable &&
                      cell.status !== "past" &&
                      "ab-datetime__day--disabled",
                    isAvailable && "ab-datetime__day--available",
                    isSelected && "ab-datetime__day--selected",
                  )}
                  onClick={() => {
                    if (isAvailable) onSelectDate(cell.date);
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {monthLoading && (
            <p className="ab-datetime__status">{t(labels, "widget.loadingAvailability")}</p>
          )}

          <div className="ab-datetime__timezone">
            <span className="ab-datetime__timezone-label">
              {t(labels, "widget.timezoneLabel")}
            </span>
            <div className="ab-datetime__timezone-value">
              <IconGlobe />
              <span>{formatTimezoneLabel(displayTimezone, locale)}</span>
            </div>
          </div>
        </div>

        <div className="ab-datetime__times">
          <h4 className={cn("ab-datetime__times-title", theme.id === "classic" && "font-serif")}>
            {t(labels, "widget.availableTimes")}
          </h4>
          {showLocalTimezoneHint && (
            <p className="ab-datetime__times-hint">
              {t(labels, "widget.timezoneHint").replace(
                "{timezone}",
                formatTimezoneLabel(userTimezone, locale),
              )}
            </p>
          )}

          {!selectedDate ? (
            <p className="ab-datetime__empty">{t(labels, "widget.selectDateFirst")}</p>
          ) : slots.length === 0 ? (
            <p className="ab-datetime__empty">{t(labels, "widget.noSlots")}</p>
          ) : (
            <div
              className={cn(
                "ab-datetime__slots",
                isModern ? "ab-datetime__slots--list" : "ab-datetime__slots--grid",
              )}
            >
              {slots.map((slot) => {
                const selected = selectedTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    className={cn(
                      "ab-datetime__slot",
                      selected && "ab-datetime__slot--selected",
                    )}
                    onClick={() => onSelectTime(slot.startTime)}
                  >
                    {formatSlotTime(slot.startTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
