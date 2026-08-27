import { toLatinDigits } from './national-id';

export function reservationCodePrefix(year: number) {
  return `${year}-`;
}

export function nextSequentialReservationCode(year: number, codes: string[]) {
  const prefix = reservationCodePrefix(year);
  let max = 0;
  for (const code of codes) {
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      max = Math.max(max, Number(suffix));
    }
  }
  const codeSeq = max + 1;
  return { code: `${prefix}${codeSeq}`, codeSeq };
}

export function normalizeReservationCode(input: string) {
  return toLatinDigits(input).trim().replace(/\s+/g, '');
}

/** Exact `{year}-{n}` like 1405-1 (Persian/Arabic digits allowed). */
export function isReservationCodeQuery(input: string) {
  return /^\d{4}-\d+$/.test(normalizeReservationCode(input));
}
