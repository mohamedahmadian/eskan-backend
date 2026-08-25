import { normalizeMobile, phoneLookupValues } from './phone';

describe('mobile phone helpers', () => {
  it('normalizes Iranian mobiles to 11 digits with leading zero', () => {
    expect(normalizeMobile('09123456789')).toBe('09123456789');
    expect(normalizeMobile('۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeMobile('+98 912 345 6789')).toBe('09123456789');
  });

  it('keeps lookup variants for stored numbers with or without zero', () => {
    expect(phoneLookupValues('09123456789')).toEqual(
      expect.arrayContaining(['09123456789', '9123456789']),
    );
  });
});
