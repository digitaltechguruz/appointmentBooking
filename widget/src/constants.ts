/** Unique root id — avoids collisions with theme sections and other apps. */
export const BOOKING_WIDGET_ROOT_ID = "ab-booking-widget-root";

export const BOOKING_WIDGET_DATA_ATTR = "data-ab-booking-widget";

export const BOOKING_WIDGET_MOUNT_SELECTOR =
  `[${BOOKING_WIDGET_DATA_ATTR}], #${BOOKING_WIDGET_ROOT_ID}`;
