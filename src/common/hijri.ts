/** Tabular Hijri calendar, aligned with the Arabic calendar shown in the UI. */

const HIJRI_EPOCH = 1948440
const SAFAR_MONTH = 2
const LATE_SAFAR_FROM_DAY = 20

function isHijriLeap(year: number) {
  return [2, 5, 7, 10, 13, 15, 18, 21, 24, 26, 29].includes(
    ((year % 30) + 30) % 30,
  )
}

function hijriMonthLengths(year: number) {
  return [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, isHijriLeap(year) ? 30 : 29]
}

function gregorianToJdn(year: number, month: number, day: number) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

function jdnToGregorian(jdn: number) {
  let l = jdn + 68569
  const n = Math.floor((4 * l) / 146097)
  l -= Math.floor((146097 * n + 3) / 4)
  const i = Math.floor((4000 * (l + 1)) / 1461001)
  l = l - Math.floor((1461 * i) / 4) + 31
  const j = Math.floor((80 * l) / 2447)
  const day = l - Math.floor((2447 * j) / 80)
  l = Math.floor(j / 11)
  const month = j + 2 - 12 * l
  const year = 100 * (n - 49) + i + l
  return { year, month, day }
}

function hijriToJdn(year: number, month: number, day: number) {
  const leaps = Math.floor((11 / 30) * (year - 1) + 0.5)
  const lengths = hijriMonthLengths(year)
  let dayOfYear = day
  for (let index = 0; index < month - 1; index += 1) {
    dayOfYear += lengths[index]
  }
  return HIJRI_EPOCH + 354 * (year - 1) + leaps + dayOfYear - 1
}

export function isoToHijri(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const jdn = gregorianToJdn(Number(match[1]), Number(match[2]), Number(match[3]))
  let year = Math.floor((jdn - HIJRI_EPOCH) / 354.366) + 1
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const start = hijriToJdn(year, 1, 1)
    const next = hijriToJdn(year + 1, 1, 1)
    if (jdn < start) year -= 1
    else if (jdn >= next) year += 1
    else break
  }
  const lengths = hijriMonthLengths(year)
  let day = jdn - hijriToJdn(year, 1, 1) + 1
  let month = 1
  for (const length of lengths) {
    if (day <= length) return { year, month, day }
    day -= length
    month += 1
  }
  return { year, month, day }
}

function hijriToIso(year: number, month: number, day: number) {
  const date = jdnToGregorian(hijriToJdn(year, month, day))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

export function lateSafarWindow(hijriYear: number) {
  const length = hijriMonthLengths(hijriYear)[SAFAR_MONTH - 1] ?? 29
  return {
    start: hijriToIso(hijriYear, SAFAR_MONTH, LATE_SAFAR_FROM_DAY),
    end: hijriToIso(hijriYear, SAFAR_MONTH, Math.min(30, length)),
  }
}

/** Stay overlaps 20 Safar through the end of Safar (30 when that day exists). */
export function stayOverlapsLateSafar(stayStart: string, stayEnd: string) {
  if (!stayStart || !stayEnd || stayEnd < stayStart) return false
  const start = isoToHijri(stayStart)
  const end = isoToHijri(stayEnd)
  if (!start || !end) return false
  for (let year = start.year; year <= end.year; year += 1) {
    const window = lateSafarWindow(year)
    if (stayStart <= window.end && window.start <= stayEnd) return true
  }
  return false
}

export function lateSafarYears(stayStart: string, stayEnd: string) {
  const years = new Set<number>()
  if (!stayOverlapsLateSafar(stayStart, stayEnd)) return years
  const start = isoToHijri(stayStart)
  const end = isoToHijri(stayEnd)
  if (!start || !end) return years
  for (let year = start.year; year <= end.year; year += 1) {
    const window = lateSafarWindow(year)
    if (stayStart <= window.end && window.start <= stayEnd) years.add(year)
  }
  return years
}
