export type HoursTimeFormat = "HOUR_12" | "HOUR_24";

export type AvailabilityDisplayPrefs = {
  hoursTimeFormat: HoursTimeFormat;
  weekStartsOn: "MONDAY" | "SUNDAY";
};

const STORAGE_PREFIX = "ab-availability-display-prefs";

export const DEFAULT_AVAILABILITY_DISPLAY_PREFS: AvailabilityDisplayPrefs = {
  hoursTimeFormat: "HOUR_24",
  weekStartsOn: "SUNDAY",
};

function storageKey(shop: string) {
  return `${STORAGE_PREFIX}:${shop}`;
}

export function loadAvailabilityDisplayPrefs(
  shop: string,
): AvailabilityDisplayPrefs {
  if (typeof window === "undefined") return DEFAULT_AVAILABILITY_DISPLAY_PREFS;

  try {
    const raw = localStorage.getItem(storageKey(shop));
    if (!raw) return DEFAULT_AVAILABILITY_DISPLAY_PREFS;

    const parsed = JSON.parse(raw) as Partial<AvailabilityDisplayPrefs>;
    return {
      hoursTimeFormat:
        parsed.hoursTimeFormat === "HOUR_12" ? "HOUR_12" : "HOUR_24",
      weekStartsOn:
        parsed.weekStartsOn === "MONDAY" ? "MONDAY" : "SUNDAY",
    };
  } catch {
    return DEFAULT_AVAILABILITY_DISPLAY_PREFS;
  }
}

export function saveAvailabilityDisplayPrefs(
  shop: string,
  prefs: AvailabilityDisplayPrefs,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(shop), JSON.stringify(prefs));
}
