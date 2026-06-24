/** @type {import('tailwindcss').Config} */
export default {
  // Scope every utility to our widget root so theme sections are never affected.
  important: "#ab-booking-widget-root",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "hover:border-[var(--ab-primary)]",
    "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
    "hover:shadow-sm",
    "hover:bg-neutral-200",
    "hover:opacity-90",
    "border-[var(--ab-primary)]",
    "bg-[var(--ab-accent)]",
    "bg-[var(--ab-primary)]",
    "border-[var(--ab-accent)]",
    "ring-[var(--ab-primary)]",
    "ring-1",
    "text-[#9a7b4f]",
    "focus-visible:outline-[var(--ab-primary)]",
    "focus:border-b-[var(--ab-primary)]",
    "!bg-[var(--ab-accent)]",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
      colors: {
        ab: {
          primary: "var(--ab-primary)",
          accent: "var(--ab-accent)",
          border: "#e8e4dc",
          muted: "#6b6b6b",
          check: "#9a7b4f",
        },
      },
      maxWidth: {
        widget: "960px",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
