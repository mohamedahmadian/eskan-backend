/** Asia/Tehran is fixed UTC+03:30 (no DST). */
const TEHRAN_OFFSET = '+03:30';

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

export function jalaliMonth(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    month: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(date);
  const match = formatted.match(/\d+/);
  if (!match) {
    throw new Error('ماه شمسی قابل تشخیص نیست');
  }
  return Number(match[0]);
}

/** Jalali civil date → Gregorian `YYYY-MM-DD` (calendar date, no timezone). */
export function jalaliToIsoDate(jy: number, jm: number, jd: number): string | null {
  if (jy < 1200 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    return null;
  }
  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jy2 = jy - 979;
  let jm2 = jm - 1;
  let jd2 = jd - 1;
  let jDayNo =
    365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; i += 1) jDayNo += jDaysInMonth[i];
  jDayNo += jd2;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo -= 1;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo += 1;
    else leap = false;
  }
  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo -= 1;
    gy += Math.floor(gDayNo / 365);
    gDayNo %= 365;
  }
  let gm = 0;
  for (; gm < 12; gm += 1) {
    const days = gDaysInMonth[gm] + (gm === 1 && leap ? 1 : 0);
    if (gDayNo < days) break;
    gDayNo -= days;
  }
  const gd = gDayNo + 1;
  return `${gy}-${String(gm + 1).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

function tehranStartOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00${TEHRAN_OFFSET}`);
}

/** Inclusive Jalali year → half-open `[Farvardin 1, next Farvardin 1)` in Tehran. */
export function jalaliYearRange(year: number): { gte: Date; lt: Date } {
  const start = jalaliToIsoDate(year, 1, 1);
  const end = jalaliToIsoDate(year + 1, 1, 1);
  if (!start || !end) {
    throw new Error(`بازه سال شمسی ${year} نامعتبر است`);
  }
  return { gte: tehranStartOfDay(start), lt: tehranStartOfDay(end) };
}

/** Inclusive Jalali month → half-open `[month/1, next month/1)` in Tehran. */
export function jalaliMonthRange(
  year: number,
  month: number,
): { gte: Date; lt: Date } {
  if (month < 1 || month > 12) {
    throw new Error(`ماه شمسی ${month} نامعتبر است`);
  }
  const start = jalaliToIsoDate(year, month, 1);
  const end =
    month === 12
      ? jalaliToIsoDate(year + 1, 1, 1)
      : jalaliToIsoDate(year, month + 1, 1);
  if (!start || !end) {
    throw new Error(`بازه ماه شمسی ${year}/${month} نامعتبر است`);
  }
  return { gte: tehranStartOfDay(start), lt: tehranStartOfDay(end) };
}
