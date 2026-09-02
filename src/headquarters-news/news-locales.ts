import { APP_LOCALES, type AppLocale } from '../common/request-locale';

export const newsSourceLocale = 'fa' as const;

export const newsTranslationLocales = APP_LOCALES.filter(
  (locale): locale is Exclude<AppLocale, 'fa'> => locale !== newsSourceLocale,
);

export type NewsTranslationLocale = (typeof newsTranslationLocales)[number];
