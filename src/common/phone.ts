import { toLatinDigits } from './national-id';

export function normalizePhone(input: string) {
  return toLatinDigits(input.trim()).replace(/[\s-]/g, '');
}
