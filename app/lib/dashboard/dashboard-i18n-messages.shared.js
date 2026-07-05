/** Metaobject section keys — keep in sync with DASHBOARD_SECTIONS in the server module. */
export const DASHBOARD_SECTION_KEYS = [
  "app",
  "nav",
  "common",
  "validation",
  "toast",
  "dashboard",
  "services",
  "availability",
  "meetingTypes",
  "bookings",
  "settings",
  "billing",
  "languages",
  "banner",
  "catalog",
];

/** Field guide for the Settings page — labels come from locale JSON via `t()`. */
export function getDashboardFieldGuide(t) {
  return DASHBOARD_SECTION_KEYS.map((key) => ({
    key,
    label: t(`languages.dashboardFields.${key}.label`),
    description: t(`languages.dashboardFields.${key}.description`),
  }));
}
