/** رمز ساده ۸رقمی با جفت‌های تکراری، مثل ۲۲۵۵۶۶۴۴ */
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

/** رمز بازیابی زائر همیشه الگوی جفت‌تکراری است (نه کد ملی). */
export function resolvePilgrimResetPassword(): string {
  return generateRepeatingDigitPassword();
}
