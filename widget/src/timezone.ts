function getZonedParts(date: Date, timeZone: string) {
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

export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Calendar date YYYY-MM-DD for "now" in a merchant IANA timezone. */
export function todayInTimezone(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

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

export function formatMerchantTimeForZone(
  dateStr: string,
  timeStr: string,
  merchantTimeZone: string,
  displayTimeZone: string,
  locale?: string,
  hour12 = true,
): string {
  const instant = merchantLocalToUtc(dateStr, timeStr, merchantTimeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone: displayTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(instant);
}

export function formatMerchantDateTimeForZone(
  dateStr: string,
  timeStr: string,
  merchantTimeZone: string,
  displayTimeZone: string,
  locale?: string,
  hour12 = true,
): string {
  const instant = merchantLocalToUtc(dateStr, timeStr, merchantTimeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone: displayTimeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(instant);
}

export function formatTimezoneShort(timeZone: string, locale?: string) {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
