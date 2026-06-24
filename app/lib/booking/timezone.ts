const WEEKDAY_TO_ENUM = {
  Sun: "SUNDAY",
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
} as const;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

/** Calendar date YYYY-MM-DD for "now" in the given IANA timezone. */
export function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDayOfWeekForDate(
  dateStr: string,
  timeZone: string,
): (typeof WEEKDAY_TO_ENUM)[keyof typeof WEEKDAY_TO_ENUM] {
  const instant = merchantLocalToUtc(dateStr, "12:00", timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant) as keyof typeof WEEKDAY_TO_ENUM;
  return WEEKDAY_TO_ENUM[weekday];
}

/** Convert merchant-local wall clock to a UTC instant. */
export function merchantLocalToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute);
    const diff = desiredMs - actualMs;
    if (diff === 0) break;
    utcMs += diff;
  }

  return new Date(utcMs);
}

export function formatTimezoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date());
    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    return `${name} (${timeZone})`;
  } catch {
    return timeZone;
  }
}

export function formatMerchantDateTimeForZone(
  dateStr: string,
  timeStr: string,
  merchantTimeZone: string,
  displayTimeZone: string,
  options?: { hour12?: boolean; locale?: string },
): string {
  const instant = merchantLocalToUtc(dateStr, timeStr, merchantTimeZone);
  return new Intl.DateTimeFormat(options?.locale ?? "en-US", {
    timeZone: displayTimeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: options?.hour12 ?? true,
  }).format(instant);
}

export function formatMerchantTimeForZone(
  dateStr: string,
  timeStr: string,
  merchantTimeZone: string,
  displayTimeZone: string,
  options?: { hour12?: boolean; locale?: string },
): string {
  const instant = merchantLocalToUtc(dateStr, timeStr, merchantTimeZone);
  return new Intl.DateTimeFormat(options?.locale ?? "en-US", {
    timeZone: displayTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: options?.hour12 ?? true,
  }).format(instant);
}

export function formatTimezoneShort(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
