import type { Prisma } from "@prisma/client";
import prisma from "../../db.server";
import {
  DEFAULT_WIDGET_APPEARANCE,
  emptyWidgetAppearance,
  metaobjectValuesToWidgetText,
  widgetTextToClientSettings,
  type WidgetAppearance,
} from "./appearance.shared";
import { widgetThemeToClient } from "./themes.server";
import type { WidgetTheme } from "@prisma/client";
import { getDefaultTranslationValues } from "./widget-text.translations.js";

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseDefaultImages(value: unknown): WidgetAppearance["defaultImages"] {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const images: WidgetAppearance["defaultImages"] = {};
  for (const key of ["ZOOM", "PHONE", "WHATSAPP", "IN_STORE"] as const) {
    const url = record[key];
    if (typeof url === "string" && url.trim()) {
      images[key] = url.trim();
    }
  }
  return images;
}

export function parseWidgetAppearance(raw: unknown): WidgetAppearance {
  const base = emptyWidgetAppearance();
  if (!raw || typeof raw !== "object") return base;

  const data = raw as Record<string, unknown>;
  return {
    visible: asBool(data.visible, base.visible),
    primaryColor: asString(data.primaryColor, base.primaryColor),
    accentColor: asString(data.accentColor, base.accentColor),
    defaultImages: parseDefaultImages(data.defaultImages),
  };
}

export function widgetAppearanceFromFormData(formData: FormData): WidgetAppearance {
  return parseWidgetAppearance({
    visible: formData.get("visible") === "on",
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    defaultImages: {
      ZOOM: formData.get("defaultImageZoom"),
      PHONE: formData.get("defaultImagePhone"),
      WHATSAPP: formData.get("defaultImageWhatsapp"),
      IN_STORE: formData.get("defaultImageInStore"),
    },
  });
}

export async function getMerchantWidgetAppearance(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { widgetContent: true },
  });
  return parseWidgetAppearance(merchant?.widgetContent);
}

export async function updateMerchantWidgetAppearance(
  merchantId: string,
  appearance: WidgetAppearance,
) {
  return prisma.merchant.update({
    where: { id: merchantId },
    data: {
      widgetContent: appearance as unknown as Prisma.InputJsonValue,
    },
  });
}

export function buildWidgetSettingsFromSources(
  translationValues: Record<string, string> | undefined,
  appearance: WidgetAppearance,
  options: { locale: string; theme: WidgetTheme },
) {
  const text = metaobjectValuesToWidgetText(
    translationValues ?? getDefaultTranslationValues("en"),
  );
  return widgetTextToClientSettings(text, appearance, {
    locale: options.locale,
    theme: widgetThemeToClient(options.theme),
  });
}

export { DEFAULT_WIDGET_APPEARANCE };
