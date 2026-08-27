import {
  isReservationCodeQuery,
  nextSequentialReservationCode,
  normalizeReservationCode,
} from './reservation-code';

describe('reservation-code', () => {
  it('starts at 1 for an empty year', () => {
    expect(nextSequentialReservationCode(1405, [])).toEqual({
      code: '1405-1',
      codeSeq: 1,
    });
  });

  it('increments the numeric suffix for the same year', () => {
    expect(
      nextSequentialReservationCode(1405, ['1405-1', '1405-12', '1404-99']),
    ).toEqual({ code: '1405-13', codeSeq: 13 });
  });

  it('normalizes Persian digits and spaces', () => {
    expect(normalizeReservationCode(' ۱۴۰۵-۱۲ ')).toBe('1405-12');
  });

  it('detects a reservation-code search', () => {
    expect(isReservationCodeQuery('1405-1')).toBe(true);
    expect(isReservationCodeQuery('۱۴۰۵-۲')).toBe(true);
    expect(isReservationCodeQuery('احمد')).toBe(false);
    expect(isReservationCodeQuery('1405')).toBe(false);
  });
});
