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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatReviewDate(dateStr: string, time: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y} at ${time}`;
}

export function buildCalendarDays(
  monthKey: string,
  monthData: {
    availableDates: string[];
    unavailableDates: string[];
    closedDates: string[];
  } | null,
): CalendarDay[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const available = new Set(monthData?.availableDates ?? []);
  const closed = new Set(monthData?.closedDates ?? []);
  const unavailable = new Set(monthData?.unavailableDates ?? []);
  const today = localTodayString();
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

  while (cells.length % 7 !== 0) {
    const idx = cells.length - startPad - daysInMonth + 1;
    cells.push({
      date: "",
      day: idx,
      inMonth: false,
      status: "unavailable",
    });
  }

  return cells;
}

export function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function countSelectableDates(
  monthKey: string,
  monthData: {
    availableDates: string[];
  } | null,
  today = localTodayString(),
) {
  if (!monthData) return 0;
  return monthData.availableDates.filter(
    (date) => date >= today && date.startsWith(monthKey),
  ).length;
}
