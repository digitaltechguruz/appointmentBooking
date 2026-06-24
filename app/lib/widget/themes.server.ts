import type { WidgetTheme } from "@prisma/client";
export { WIDGET_THEME_OPTIONS, parseWidgetTheme } from "./themes.shared";
export type { WidgetThemeId } from "./themes.shared";

export function widgetThemeToClient(theme: WidgetTheme): "classic" | "modern" {
  return theme === "MODERN" ? "modern" : "classic";
}
