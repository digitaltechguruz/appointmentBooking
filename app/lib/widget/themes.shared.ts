export type WidgetThemeId = "CLASSIC" | "MODERN";

export const WIDGET_THEME_OPTIONS = [
  {
    id: "CLASSIC" as const,
    label: "Classic",
    description: "Elegant serif headings, refined borders, and a jewelry-showroom feel.",
  },
  {
    id: "MODERN" as const,
    label: "Modern",
    description: "Bold sans-serif type, rounded cards, and soft shadows for a clean look.",
  },
] satisfies Array<{
  id: WidgetThemeId;
  label: string;
  description: string;
}>;

export function parseWidgetTheme(value: unknown): WidgetThemeId {
  if (value === "MODERN" || value === "modern") return "MODERN";
  return "CLASSIC";
}
