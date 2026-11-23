import { APP_LOCALES, type AppLocale } from './request-locale';

export const contentSourceLocale = 'fa' as const;

export const contentTranslationLocales = APP_LOCALES.filter(
  (locale): locale is Exclude<AppLocale, 'fa'> => locale !== contentSourceLocale,
);

export type ContentTranslationLocale = (typeof contentTranslationLocales)[number];
