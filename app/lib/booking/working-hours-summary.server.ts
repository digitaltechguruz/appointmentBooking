import type { AvailabilityRule, ClosedDate, DayOfWeek } from "@prisma/client";
import { DAYS_OF_WEEK } from "../constants";
import { formatDateString } from "./time.server";

const DAY_NAMES: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

function compressDayList(days: DayOfWeek[]): string {
  if (days.length === 0) return "";
  if (days.length === 7) return "daily";

  const indices = days.map((d) => DAYS_OF_WEEK.indexOf(d)).sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = indices[0];
  let prev = indices[0];

  for (let i = 1; i <= indices.length; i++) {
    const cur = indices[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(formatDayRange(rangeStart, prev));
    rangeStart = cur;
    prev = cur;
  }

  return parts.join(", ");
}

function formatDayRange(startIdx: number, endIdx: number): string {
  const startDay = DAYS_OF_WEEK[startIdx];
  const endDay = DAYS_OF_WEEK[endIdx];
  if (startIdx === endIdx) return DAY_NAMES[startDay];
  return `${DAY_NAMES[startDay]}–${DAY_NAMES[endDay]}`;
}

export function formatWorkingHoursSummary(rules: AvailabilityRule[]): string {
  const ruleMap = new Map(rules.map((r) => [r.dayOfWeek, r]));
  const enabled = DAYS_OF_WEEK.filter((d) => ruleMap.get(d)?.enabled);
  const disabled = DAYS_OF_WEEK.filter((d) => !ruleMap.get(d)?.enabled);

  if (enabled.length === 0) {
    return "No booking hours configured.";
  }

  const groups = new Map<string, DayOfWeek[]>();
  for (const day of enabled) {
    const rule = ruleMap.get(day)!;
    const key = `${rule.startTime}-${rule.endTime}`;
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }

  const openParts = [...groups.entries()].map(([hours, days]) => {
    const [start, end] = hours.split("-");
    const dayLabel = compressDayList(days);
    if (dayLabel === "daily") return `Open daily, ${start} – ${end}`;
    return `Open ${dayLabel}, ${start} – ${end}`;
  });

  let summary = openParts.join(". ");
  if (disabled.length > 0 && disabled.length < 7) {
    summary += `. Closed ${compressDayList(disabled)}`;
  }

  return summary.endsWith(".") ? summary : `${summary}.`;
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatClosedRangeLabel(closed: ClosedDate): string {
  const start = formatDateString(closed.date);
  const end = formatDateString(closed.endDate);
  const range =
    start === end
      ? formatDisplayDate(start)
      : `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  return closed.reason ? `${range} (${closed.reason})` : range;
}

export function formatUpcomingClosuresSummary(closedDates: ClosedDate[]): string {
  const today = formatDateString(new Date());
  const upcoming = closedDates
    .filter((cd) => formatDateString(cd.endDate) >= today)
    .slice(0, 5);

  if (upcoming.length === 0) return "";
  const labels = upcoming.map(formatClosedRangeLabel);
  return `Upcoming closures: ${labels.join("; ")}.`;
}

export function buildStep3Subtitle(
  rules: AvailabilityRule[],
  closedDates: ClosedDate[],
): string {
  const hours = formatWorkingHoursSummary(rules);
  const closures = formatUpcomingClosuresSummary(closedDates);
  return [hours, closures].filter(Boolean).join(" ");
}
