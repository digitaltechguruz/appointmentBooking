export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
  status: "available" | "unavailable" | "closed" | "past";
};

/** Local calendar date YYYY-MM-DD (matches server date strings). */
export function localTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


export function formatMonthLabel(monthKey: string, locale = "en") {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

/** Monday-first weekday headers for the calendar grid. */
export function getWeekdayHeaders(locale = "en") {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
}

export function formatReviewDate(dateStr: string, time: string, locale = "en") {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
  return `${dateLabel} at ${time}`;
}

export function formatShortDateLabel(dateStr: string, locale?: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function buildCalendarDays(
  monthKey: string,
  monthData: {
    availableDates: string[];
    unavailableDates: string[];
    closedDates: string[];
  } | null,
  today = localTodayString(),
): CalendarDay[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const available = new Set(monthData?.availableDates ?? []);
  const closed = new Set(monthData?.closedDates ?? []);
  const unavailable = new Set(monthData?.unavailableDates ?? []);
  const cells: CalendarDay[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
      inMonth: false,
      status: "unavailable",
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let status: CalendarDay["status"] = "unavailable";

    if (date < today) {
      status = "past";
    } else if (closed.has(date)) {
      status = "closed";
    } else if (available.has(date)) {
      status = "available";
    } else if (unavailable.has(date)) {
      status = "unavailable";
    }

    cells.push({ date, day, inMonth: true, status });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const date = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
    cells.push({
      date,
      day: nextDay,
      inMonth: false,
      status: "unavailable",
    });
    nextDay += 1;
  }

  return cells;
}

export function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function compareMonthKeys(a: string, b: string) {
  return a.localeCompare(b);
}

export function isMonthBefore(a: string, b: string) {
  return compareMonthKeys(a, b) < 0;
}

export function isMonthAfter(a: string, b: string) {
  return compareMonthKeys(a, b) > 0;
}

export function monthKeyFromDateString(dateStr: string) {
  return dateStr.slice(0, 7);
}

export function clampMonthKey(
  monthKey: string,
  minMonth: string,
  maxMonth: string | null,
) {
  if (isMonthBefore(monthKey, minMonth)) return minMonth;
  if (maxMonth && isMonthAfter(monthKey, maxMonth)) return maxMonth;
  return monthKey;
}

export function countSelectableDates(
  monthKey: string,
  monthData: {
    availableDates: string[];
  } | null,
  today: string = localTodayString(),
) {
  if (!monthData) return 0;
  return monthData.availableDates.filter(
    (date) => date >= today && date.startsWith(monthKey),
  ).length;
}
