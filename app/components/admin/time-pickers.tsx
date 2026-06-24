import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayOfWeek } from "@prisma/client";
import { parseTimeToMinutes, minCloseTimeAfter } from "../../lib/booking/time";

const HOUR_OPTIONS_24 = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const HOUR_OPTIONS_12 = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export type HoursTimeFormat = "HOUR_12" | "HOUR_24";

export function splitTime(time: string) {
  const [hour = "09", minute = "00"] = time.split(":");
  return { hour, minute };
}

export function joinTime(hour: string, minute: string) {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function to12Hour(time24: string) {
  const { hour, minute } = splitTime(time24);
  const hourNum = Number(hour);
  const period = hourNum >= 12 ? "PM" : "AM";
  const hour12 = hourNum % 12 || 12;
  return {
    hour: String(hour12).padStart(2, "0"),
    minute,
    period: period as "AM" | "PM",
  };
}

function to24Hour(hour12: string, minute: string, period: "AM" | "PM") {
  let hourNum = Number(hour12) % 12;
  if (period === "PM") hourNum += 12;
  return joinTime(String(hourNum), minute);
}

function hourHasValidCloseMinute24(hour: string, minTime: string) {
  const minM = parseTimeToMinutes(minTime);
  return MINUTE_OPTIONS.some(
    (m) => parseTimeToMinutes(joinTime(hour, m)) > minM,
  );
}

function getHourOptions24(minTime?: string) {
  if (!minTime) return HOUR_OPTIONS_24;
  return HOUR_OPTIONS_24.filter((h) => hourHasValidCloseMinute24(h, minTime));
}

function getMinuteOptions24(minTime: string | undefined, hour: string) {
  if (!minTime) return MINUTE_OPTIONS;
  const minM = parseTimeToMinutes(minTime);
  return MINUTE_OPTIONS.filter(
    (m) => parseTimeToMinutes(joinTime(hour, m)) > minM,
  );
}

function hourHasValidCloseMinute12(
  hour: string,
  period: "AM" | "PM",
  minTime: string,
) {
  const minM = parseTimeToMinutes(minTime);
  return MINUTE_OPTIONS.some(
    (m) => parseTimeToMinutes(to24Hour(hour, m, period)) > minM,
  );
}

function getHourOptions12(minTime: string | undefined, period: "AM" | "PM") {
  if (!minTime) return HOUR_OPTIONS_12;
  return HOUR_OPTIONS_12.filter((h) =>
    hourHasValidCloseMinute12(h, period, minTime),
  );
}

function getMinuteOptions12(
  minTime: string | undefined,
  hour: string,
  period: "AM" | "PM",
) {
  if (!minTime) return MINUTE_OPTIONS;
  const minM = parseTimeToMinutes(minTime);
  return MINUTE_OPTIONS.filter(
    (m) => parseTimeToMinutes(to24Hour(hour, m, period)) > minM,
  );
}

function getPeriodOptions12(minTime?: string): Array<"AM" | "PM"> {
  if (!minTime) return ["AM", "PM"];
  return (["AM", "PM"] as const).filter((period) =>
    HOUR_OPTIONS_12.some((h) => hourHasValidCloseMinute12(h, period, minTime)),
  );
}

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  idPrefix: string;
  format?: HoursTimeFormat;
  /** When set, only times strictly after this are selectable (for close pickers). */
  minTime?: string;
};

export function TimePickerSelect({
  value,
  onChange,
  disabled,
  idPrefix,
  format = "HOUR_24",
  minTime,
}: TimePickerProps) {
  useEffect(() => {
    if (!minTime) return;
    if (parseTimeToMinutes(value) <= parseTimeToMinutes(minTime)) {
      onChange(minCloseTimeAfter(minTime));
    }
  }, [minTime, value, onChange]);

  if (format === "HOUR_12") {
    const { hour, minute, period } = to12Hour(value);
    const hourOptions = getHourOptions12(minTime, period);
    const minuteOptions = getMinuteOptions12(minTime, hour, period);
    const periodOptions = getPeriodOptions12(minTime);
    const safeHour = hourOptions.includes(hour) ? hour : hourOptions[0] ?? hour;
    const safeMinute = minuteOptions.includes(minute)
      ? minute
      : minuteOptions[0] ?? minute;
    const safePeriod = periodOptions.includes(period)
      ? period
      : periodOptions[0] ?? period;

    return (
      <span className="ab-time-picker ab-time-picker--12h">
        <select
          id={`${idPrefix}-hour`}
          className="ab-time-picker__select ab-time-picker__select--hour"
          value={safeHour}
          disabled={disabled}
          onChange={(e) =>
            onChange(to24Hour(e.target.value, safeMinute, safePeriod))
          }
          aria-label="Hour"
        >
          {hourOptions.map((h) => (
            <option key={h} value={h}>
              {Number(h)}
            </option>
          ))}
        </select>
        <span className="ab-time-picker__sep">:</span>
        <select
          id={`${idPrefix}-minute`}
          className="ab-time-picker__select ab-time-picker__select--minute"
          value={safeMinute}
          disabled={disabled}
          onChange={(e) =>
            onChange(to24Hour(safeHour, e.target.value, safePeriod))
          }
          aria-label="Minute"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          id={`${idPrefix}-period`}
          className="ab-time-picker__select ab-time-picker__select--period"
          value={safePeriod}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              to24Hour(safeHour, safeMinute, e.target.value as "AM" | "PM"),
            )
          }
          aria-label="AM or PM"
        >
          {periodOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </span>
    );
  }

  const { hour, minute } = splitTime(value);
  const hourOptions = getHourOptions24(minTime);
  const minuteOptions = getMinuteOptions24(minTime, hour);
  const safeHour = hourOptions.includes(hour) ? hour : hourOptions[0] ?? hour;
  const safeMinute = minuteOptions.includes(minute)
    ? minute
    : minuteOptions[0] ?? minute;

  return (
    <span className="ab-time-picker">
      <select
        id={`${idPrefix}-hour`}
        className="ab-time-picker__select ab-time-picker__select--hour"
        value={safeHour}
        disabled={disabled}
        onChange={(e) => onChange(joinTime(e.target.value, safeMinute))}
        aria-label="Hour"
      >
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="ab-time-picker__sep">:</span>
      <select
        id={`${idPrefix}-minute`}
        className="ab-time-picker__select ab-time-picker__select--minute"
        value={safeMinute}
        disabled={disabled}
        onChange={(e) => onChange(joinTime(safeHour, e.target.value))}
        aria-label="Minute"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}

export const CopyHoursButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: () => void;
    active?: boolean;
  }
>(function CopyHoursButton({ label, onClick, active }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ab-copy-btn${active ? " ab-copy-btn--active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={active}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect
          x="5"
          y="5"
          width="8"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d="M4 11V4.5C4 3.67 4.67 3 5.5 3H11"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
});

export function CopyTimesPopover({
  anchorRef,
  sourceDay,
  days,
  dayLabels,
  onApply,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  sourceDay: DayOfWeek;
  days: DayOfWeek[];
  dayLabels: Record<DayOfWeek, string>;
  onApply: (targets: DayOfWeek[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const targetDays = days.filter((day) => day !== sourceDay);
  const [selected, setSelected] = useState<Set<DayOfWeek>>(new Set());
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = ref.current;
    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const popoverWidth = popoverRect.width || 220;
    const popoverHeight = popoverRect.height || 280;
    const margin = 8;

    let top = anchorRect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - margin) {
      top = anchorRect.top - popoverHeight - 6;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

    let left = anchorRect.right - popoverWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    setPosition({ top, left });
  }, [anchorRef, targetDays.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRef, onClose]);

  const toggleDay = (day: DayOfWeek, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(day);
      else next.delete(day);
      return next;
    });
  };

  const allSelected = selected.size === targetDays.length && targetDays.length > 0;

  const popover = (
    <div
      className="ab-copy-popover ab-copy-popover--fixed"
      ref={ref}
      role="dialog"
      aria-label="Copy times to"
      style={
        position
          ? { top: position.top, left: position.left }
          : { visibility: "hidden" }
      }
    >
      <div className="ab-copy-popover__title">Copy times to...</div>
      <div className="ab-copy-popover__options">
        <label className="ab-copy-popover__option">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(targetDays) : new Set())
            }
          />
          Copy to all
        </label>
        {targetDays.map((day) => (
          <label key={day} className="ab-copy-popover__option">
            <input
              type="checkbox"
              checked={selected.has(day)}
              onChange={(e) => toggleDay(day, e.target.checked)}
            />
            {dayLabels[day]}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="ab-copy-popover__apply"
        disabled={selected.size === 0}
        onClick={() => onApply([...selected])}
      >
        Apply
      </button>
    </div>
  );

  return createPortal(popover, document.body);
}

export function getWeekDisplayOrder(weekStartsOn: "MONDAY" | "SUNDAY"): DayOfWeek[] {
  if (weekStartsOn === "MONDAY") {
    return [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ];
  }
  return [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
}

export function formatTimeDisplay(time: string, format: HoursTimeFormat) {
  if (format === "HOUR_24") return time;
  const { hour, minute, period } = to12Hour(time);
  return `${Number(hour)}:${minute} ${period}`;
}
