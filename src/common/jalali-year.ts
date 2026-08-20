export function currentJalaliYear(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(date);
  const match = formatted.match(/\d+/);
  if (!match) {
    throw new Error('سال شمسی قابل تشخیص نیست');
  }
  return Number(match[0]);
}
