import {
  localeFromCountryIso2,
  registerLocaleFromCountryIso2,
} from './request-locale';

describe('localeFromCountryIso2', () => {
  it('maps seeded pilgrimage countries to supported locales', () => {
    expect(localeFromCountryIso2('IR')).toBe('fa');
    expect(localeFromCountryIso2('iq')).toBe('ar');
    expect(localeFromCountryIso2('PK')).toBe('ur');
    expect(localeFromCountryIso2('IN')).toBe('hi');
    expect(localeFromCountryIso2('AF')).toBe('fa');
  });

  it('falls back to English when the country language is not supported', () => {
    expect(localeFromCountryIso2('TR')).toBe('en');
    expect(localeFromCountryIso2('DE')).toBe('en');
    expect(localeFromCountryIso2(null)).toBe('en');
    expect(localeFromCountryIso2('')).toBe('en');
  });
});

describe('registerLocaleFromCountryIso2', () => {
  it('uses Persian for Iran, Arabic for Iraq, and English otherwise', () => {
    expect(registerLocaleFromCountryIso2('IR')).toBe('fa');
    expect(registerLocaleFromCountryIso2('iq')).toBe('ar');
    expect(registerLocaleFromCountryIso2('SA')).toBe('en');
    expect(registerLocaleFromCountryIso2('PK')).toBe('en');
    expect(registerLocaleFromCountryIso2(null)).toBe('en');
  });
});
