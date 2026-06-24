import prisma from "../db.server";
import type { AppLocale } from "@prisma/client";
import { DEFAULT_TRANSLATION_KEYS } from "../lib/constants";
import { DEFAULT_LABELS } from "../lib/translations/defaults";

const defaultLabelsMap: Record<string, string> = DEFAULT_LABELS;

export async function getTranslationsForLocale(
  merchantId: string,
  locale: AppLocale,
) {
  const overrides = await prisma.translation.findMany({
    where: { merchantId, locale },
  });

  const map: Record<string, string> = {};
  for (const key of DEFAULT_TRANSLATION_KEYS) {
    map[key] = defaultLabelsMap[key] ?? key;
  }
  for (const row of overrides) {
    map[row.key] = row.value;
  }
  return map;
}

export async function listTranslationOverrides(merchantId: string, locale: AppLocale) {
  return prisma.translation.findMany({
    where: { merchantId, locale },
    orderBy: { key: "asc" },
  });
}

export async function upsertTranslation(
  merchantId: string,
  locale: AppLocale,
  key: string,
  value: string,
) {
  return prisma.translation.upsert({
    where: { merchantId_locale_key: { merchantId, locale, key } },
    create: { merchantId, locale, key, value },
    update: { value },
  });
}

export async function deleteTranslation(merchantId: string, id: string) {
  return prisma.translation.delete({
    where: { id, merchantId },
  });
}
