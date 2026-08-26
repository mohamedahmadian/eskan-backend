import { AsyncLocalStorage } from 'node:async_hooks';

export const APP_LOCALES = ['fa', 'ar', 'ur', 'en', 'hi'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

const store = new AsyncLocalStorage<AppLocale>();

export function parseAcceptLanguage(
  header?: string | string[],
): AppLocale {
  const raw = Array.isArray(header) ? header[0] : header;
  const code = (raw ?? '')
    .split(',')[0]
    ?.trim()
    .split(';')[0]
    ?.trim()
    .split('-')[0]
    ?.toLowerCase();
  if (code === 'ar' || code === 'ur' || code === 'en' || code === 'hi') {
    return code;
  }
  return 'fa';
}

export function runWithRequestLocale(locale: AppLocale, next: () => void) {
  store.run(locale, next);
}

export function getRequestLocale(): AppLocale {
  return store.getStore() ?? 'fa';
}

export function isLtrLocale(locale: AppLocale) {
  return locale === 'en' || locale === 'hi';
}

export function localizedGeoName(item: {
  nameFa: string;
  nameEn?: string | null;
}) {
  const locale = getRequestLocale();
  if (isLtrLocale(locale)) return item.nameEn || item.nameFa;
  return item.nameFa || item.nameEn || '';
}
