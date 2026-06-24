import { cn } from "./cn";
import { getWidgetTheme, type WidgetThemeId } from "./theme-styles";

export const widgetRootClass = getWidgetTheme("classic").widgetRoot;

export function serviceCardClass(selected: boolean, theme: WidgetThemeId = "classic") {
  return getWidgetTheme(theme).serviceCard(selected);
}

export const cardImageWrapClass = getWidgetTheme("classic").cardImageWrap;

export const cardImageClass =
  "block h-auto max-h-[120px] w-auto max-w-full object-contain object-center";

export const cardImagePlaceholderClass =
  "h-[100px] w-full bg-gradient-to-br from-neutral-100 to-neutral-200";

export function stepCircleClass(
  state: "done" | "active" | "upcoming",
  theme: WidgetThemeId = "classic",
) {
  return getWidgetTheme(theme).stepCircle(state);
}

export const cardGridClass = getWidgetTheme("classic").cardGrid;

export const inputClass = getWidgetTheme("classic").input;

export const phoneCountrySelectClass = getWidgetTheme("classic").phoneCountrySelect;

export const labelClass = getWidgetTheme("classic").label;
