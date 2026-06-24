import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdminMerchant, requirePublicMerchant } from "../lib/auth.server";
import {
  getTranslationsForLocale,
  listTranslationOverrides,
  upsertTranslation,
} from "../models/translation.server";
import { z } from "zod";
import type { AppLocale } from "@prisma/client";
import { SUPPORTED_LOCALES } from "../lib/constants";
import { DEFAULT_TRANSLATION_KEYS } from "../lib/constants";

const querySchema = z.object({
  shop: z.string().optional(),
  locale: z.enum(["en", "fr", "de", "nl", "it", "es", "ru", "ar"]).default("en"),
});

const upsertSchema = z.object({
  locale: z.enum(["en", "fr", "de", "nl", "it", "es", "ru", "ar"]),
  key: z.string().min(1),
  value: z.string().min(1),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const isAdmin = url.pathname.startsWith("/api/translations") && !url.searchParams.has("shop");

  if (url.searchParams.has("shop") || url.searchParams.get("path_prefix")) {
    const { merchant } = await requirePublicMerchant(request);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    const locale = (parsed.success ? parsed.data.locale : "en") as AppLocale;
    const translations = await getTranslationsForLocale(merchant.id, locale);
    return Response.json({ translations, locale });
  }

  const { merchant } = await requireAdminMerchant(request);
  const locale = (url.searchParams.get("locale") ?? "en") as AppLocale;
  const overrides = await listTranslationOverrides(merchant.id, locale);
  return Response.json({
    locale,
    keys: DEFAULT_TRANSLATION_KEYS,
    overrides,
    supportedLocales: SUPPORTED_LOCALES,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = await upsertTranslation(
    merchant.id,
    parsed.data.locale,
    parsed.data.key,
    parsed.data.value,
  );
  return Response.json({ translation: row });
};
