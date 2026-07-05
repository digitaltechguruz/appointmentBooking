import { createContext, useContext, useEffect, useMemo } from "react";
import en from "../../locales/en.json";

type AdminI18nContextValue = {
  locale: string;
  messages: Record<string, unknown>;
  t: (key: string, vars?: Record<string, unknown>) => string;
};

const AdminI18nContext = createContext<AdminI18nContextValue | null>(null);

function getByPath(obj: Record<string, unknown> | null | undefined, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function AdminI18nProvider({
  locale,
  messages,
  fallbackMessages = en,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  fallbackMessages?: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    function t(key: string, vars: Record<string, unknown> = {}): string {
      let text =
        getByPath(messages, key) ??
        getByPath(fallbackMessages, key) ??
        getByPath(en as Record<string, unknown>, key) ??
        key;
      if (typeof text !== "string") return key;
      for (const [name, val] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(val ?? ""));
      }
      return text;
    }

    return { locale, messages, t };
  }, [locale, messages, fallbackMessages]);

  useEffect(() => {
    if (typeof document !== "undefined" && locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>
  );
}

export function useAdminI18n() {
  const ctx = useContext(AdminI18nContext);
  if (!ctx) {
    throw new Error("useAdminI18n must be used within AdminI18nProvider");
  }
  return ctx;
}
