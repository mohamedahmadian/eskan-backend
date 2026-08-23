/** رمز ساده ۸رقمی با جفت‌های تکراری، مثل ۸۸۲۲۵۵۶۶ */
export function generateRepeatingDigitPassword(): string {
  const pairs: number[] = [];
  while (pairs.length < 4) {
    const min = pairs.length === 0 ? 1 : 0;
    const digit = min + Math.floor(Math.random() * (10 - min));
    if (pairs.length && pairs[pairs.length - 1] === digit) {
      continue;
    }
    pairs.push(digit);
  }
  return pairs.map((digit) => `${digit}${digit}`).join('');
}

export function resolvePilgrimResetPassword(nationalId?: string | null): string {
  const id = nationalId?.trim() ?? '';
  if (id.length >= 8) {
    return id;
  }
  return generateRepeatingDigitPassword();
}
