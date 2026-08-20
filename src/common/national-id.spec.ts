import { isValidIranianNationalId, normalizeNationalId } from './national-id';

describe('iranian national id', () => {
  it('accepts a valid checksum and leading-zero padding', () => {
    expect(isValidIranianNationalId('0123456789')).toBe(true);
    expect(isValidIranianNationalId('۰۱۲۳۴۵۶۷۸۹')).toBe(true);
    expect(isValidIranianNationalId('123456789')).toBe(true);
    expect(normalizeNationalId('123456789')).toBe('0123456789');
  });

  it('rejects invalid length, repeating digits, and bad checksum', () => {
    expect(isValidIranianNationalId('0123456780')).toBe(false);
    expect(isValidIranianNationalId('1111111111')).toBe(false);
    expect(isValidIranianNationalId('12345678')).toBe(false);
    expect(isValidIranianNationalId('123')).toBe(false);
    expect(isValidIranianNationalId('')).toBe(false);
  });
});
