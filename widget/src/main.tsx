import { createRoot } from "react-dom/client";
import { BookingWidget } from "./BookingWidget";
import type { WidgetSettings } from "./types";
import {
  BOOKING_WIDGET_MOUNT_SELECTOR,
} from "./constants";
import "./index.css";

declare global {
  interface Window {
    __AB_BOOKING_WIDGET_INIT__?: boolean;
  }
}

const DEFAULT_SETTINGS: WidgetSettings = {
  title: "Book an Appointment",
  subtitle: "Choose a service and pick a time that works for you",
  step1Title: "What brings you in?",
  step1Subtitle:
    "Select the type of appointment. Each visit is private and at our showroom.",
  step2Title: "How would you like to meet?",
  step2Subtitle: "Choose what works best for you. All options are free.",
  step3Intro:
    "In-store, video, or a quick call — choose whatever works for you. Our team will guide you through every option.",
  step3Title: "Choose a date and time",
  step3Subtitle: "Auto from working hours and closed dates",
  step4Title: "Your details",
  step4Subtitle:
    "We'll send a confirmation to your email. WhatsApp reminders available if you add your number.",
  step5Title: "Review your appointment",
  step5Subtitle:
    "Check the details below before confirming. You'll receive a confirmation email immediately.",
  primaryButtonText: "Confirm appointment",
  confirmationText: "Your appointment has been confirmed!",
  primaryColor: "#0d2e26",
  accentColor: "#f5f0e8",
  visible: true,
  locale: "en",
  defaultImages: {},
};

function parseSettings(raw: string | undefined, locale: string): WidgetSettings {
  let settings: WidgetSettings = { ...DEFAULT_SETTINGS, locale };
  if (!raw) return settings;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetSettings>;
    settings = { ...settings, ...parsed, locale: parsed.locale || locale };
  } catch {
    /* use defaults */
  }
  return settings;
}

function mountWidget(root: HTMLElement) {
  if (root.dataset.abInitialized === "true") return;
  root.dataset.abInitialized = "true";

  const shop = root.dataset.shop ?? "";
  const apiBase = root.dataset.apiBase ?? "/apps/booking";
  const locale = root.dataset.locale ?? "en";
  const settings = parseSettings(root.dataset.settings, locale);

  const reactRoot = createRoot(root);
  reactRoot.render(
    <BookingWidget shop={shop} apiBase={apiBase} settings={settings} />,
  );
}

function init() {
  const nodes = document.querySelectorAll<HTMLElement>(BOOKING_WIDGET_MOUNT_SELECTOR);
  if (nodes.length === 0) return;

  window.__AB_BOOKING_WIDGET_INIT__ = true;
  nodes.forEach((root) => {
    try {
      mountWidget(root);
    } catch (error) {
      console.error("[booking-widget] mount failed", error);
      root.innerHTML =
        '<p class="ab-booking-widget ab-booking-widget--error" style="padding:1rem;color:#b91c1c;font:14px system-ui,sans-serif">Appointment booking could not load. Refresh the page or try again later.</p>';
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
