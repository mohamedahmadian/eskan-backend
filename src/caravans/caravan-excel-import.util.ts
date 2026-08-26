import * as ExcelJS from 'exceljs';
import { jalaliToIsoDate } from '../common/jalali-year';
import {
  normalizeNationalId,
  toLatinDigits,
} from '../common/national-id';
import { normalizeMobile } from '../common/phone';
import { splitFullName } from '../users/user-profile.util';

export type CaravanImportRow = {
  rowNumber: number;
  caravanName: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phone: string;
  cityName: string | null;
  cityId?: string | null;
  birthDate: string | null;
  years: number[];
  adjustments: string[];
};

export type CaravanImportIssueRow = {
  rowNumber: number;
  caravanName: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  city: string;
  birthDate: string;
  year: string;
  reasons: string[];
};

export type ParsedCaravanImport = {
  rows: CaravanImportRow[];
  invalid: number;
  invalidRows: CaravanImportIssueRow[];
  adjusted: number;
  adjustedRows: CaravanImportIssueRow[];
};

type ColKey =
  | 'caravanName'
  | 'managerFirst'
  | 'managerLast'
  | 'managerFull'
  | 'nationalId'
  | 'phone'
  | 'city'
  | 'birthDate'
  | 'year'
  | 'rowFirst'
  | 'rowLast';

const HEADER_ALIASES: Record<ColKey, string[]> = {
  caravanName: ['نامکاروان', 'کاروان'],
  managerFirst: ['ناممدیرکاروان', 'ناممدیر'],
  managerLast: ['نامخانوادگیمدیرکاروان', 'نامخانوادگیمدیر'],
  managerFull: ['مدیرکاروان'],
  nationalId: ['کدملی', 'nationalid', 'nationalcode'],
  phone: [
    'شمارههمراه',
    'تلفنهمراه',
    'شمارهموبایل',
    'تلفن',
    'موبایل',
    'همراه',
    'phone',
    'mobile',
  ],
  city: ['شهر', 'city'],
  birthDate: ['تاریختولد', 'تاریخولد', 'birthdate'],
  year: ['عنوانسال', 'سالفعالیت', 'سال', 'year'],
  rowFirst: ['نام', 'firstname'],
  rowLast: ['نامخانوادگی', 'lastname'],
};

const DEFAULT_COLUMNS: Record<
  'caravanName' | 'managerFirst' | 'managerLast' | 'nationalId' | 'phone' | 'city' | 'birthDate' | 'year',
  number
> = {
  caravanName: 1,
  managerFirst: 2,
  managerLast: 3,
  nationalId: 4,
  phone: 5,
  city: 6,
  birthDate: 7,
  year: 8,
};

function normalizeHeader(value: string) {
  return toLatinDigits(value)
    .replace(/[\u200c\u200d]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[_-\s]/g, '')
    .toLowerCase()
    .trim();
}

function cellToRaw(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (typeof value === 'object') {
    if (value instanceof Date) return value;
    if ('result' in value) return cellToRaw(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('hyperlink' in value && 'text' in value) return value.text;
  }
  return value;
}

function cellToText(value: ExcelJS.CellValue): string {
  const raw = cellToRaw(value);
  if (raw == null) return '';
  if (raw instanceof Date) {
    return dateToIso(raw) ?? '';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return toLatinDigits(String(raw).trim());
  }
  return toLatinDigits(String(raw).trim());
}

function dateToIso(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function parseBirthDateText(input: string): string | null {
  const latin = toLatinDigits(input)
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
  if (!latin) return null;
  const dateOnly = (latin.split(/[T\s]/)[0] ?? '').replace(/[٫٬]/g, '/');
  if (!dateOnly) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateOnly);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year >= 1700) {
      return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
    }
    return jalaliToIsoDate(year, month, day);
  }

  const slashed = dateOnly.replace(/[.]/g, '/');
  const parts = slashed.split(/[/\\-–—]/).map((part) => Number(part));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n > 0)) {
    const [first, second, third] = parts;
    if (third >= 1200 && third <= 1600 && first <= 31) {
      return jalaliToIsoDate(third, second, first);
    }
    if (first >= 1200 && first <= 1600) {
      return jalaliToIsoDate(first, second, third);
    }
    if (first >= 1700 && first <= 2200) {
      return `${first}-${padDatePart(second)}-${padDatePart(third)}`;
    }
  }
  return null;
}

function parseBirthDate(value: ExcelJS.CellValue): string | null {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    return parseBirthDateText(raw);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const year = raw.getUTCFullYear();
    if (year >= 1200 && year <= 1600) {
      return jalaliToIsoDate(year, raw.getUTCMonth() + 1, raw.getUTCDate());
    }
    return dateToIso(raw);
  }
  if (typeof raw === 'number') {
    const asText = parseBirthDateText(String(raw));
    if (asText) return asText;
    return excelSerialToIso(raw);
  }
  return parseBirthDateText(cellToText(value));
}

function birthDateDisplay(value: ExcelJS.CellValue): string {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return '';
  if (raw instanceof Date) return dateToIso(raw) ?? '';
  if (typeof raw === 'number') return excelSerialToIso(raw) ?? String(raw);
  return toLatinDigits(String(raw).trim());
}

function hasCellInput(value: ExcelJS.CellValue) {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return false;
  if (raw instanceof Date) return true;
  if (typeof raw === 'number') return Number.isFinite(raw);
  return String(raw).trim().length > 0;
}

function parseYear(value: ExcelJS.CellValue): number | null {
  const text = cellToText(value);
  if (!text) return null;
  const match = text.match(/(13|14|15)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  if (year < 1300 || year > 1600) return null;
  return year;
}

function parsePhone(value: ExcelJS.CellValue): string {
  const text = cellToText(value).replace(/\s+/g, '');
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (!digits) return '';
  return normalizeMobile(digits);
}

function parseNationalId(value: ExcelJS.CellValue): string {
  const text = cellToText(value).replace(/\s+/g, '');
  if (!text) return '';
  return normalizeNationalId(text);
}

export function normalizeCaravanNameKey(name: string) {
  return toLatinDigits(name)
    .replace(/[\u200c\u200d]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizePersonName(name: string) {
  return toLatinDigits(name)
    .replace(/[\u200c\u200d]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matchHeaderKey(normalized: string): ColKey | null {
  let best: { key: ColKey; len: number } | null = null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [ColKey, string[]]
  >) {
    for (const alias of aliases) {
      if (normalized === alias && alias.length >= (best?.len ?? 0)) {
        best = { key, len: alias.length };
      }
    }
  }
  return best?.key ?? null;
}

function detectColumns(row: ExcelJS.Row): Partial<Record<ColKey, number>> | null {
  const mapped: Partial<Record<ColKey, number>> = {};
  let hits = 0;
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = matchHeaderKey(normalizeHeader(cellToText(cell.value)));
    if (!key || mapped[key]) return;
    mapped[key] = col;
    hits += 1;
  });
  return hits >= 3 ? mapped : null;
}

function cellOf(row: ExcelJS.Row, col: number | undefined): ExcelJS.CellValue {
  if (!col) return null;
  return row.getCell(col).value;
}

function issueDisplay(input: {
  caravanName: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  city: string;
  birthDate: string;
  year: string;
}): Omit<CaravanImportIssueRow, 'rowNumber' | 'reasons'> {
  return {
    caravanName: input.caravanName,
    firstName: input.firstName,
    lastName: input.lastName,
    nationalId: input.nationalId,
    phone: input.phone,
    city: input.city,
    birthDate: input.birthDate,
    year: input.year,
  };
}

function toDedicatedRow(
  rowNumber: number,
  caravanRaw: ExcelJS.CellValue,
  firstRaw: ExcelJS.CellValue,
  lastRaw: ExcelJS.CellValue,
  nationalIdRaw: ExcelJS.CellValue,
  phoneRaw: ExcelJS.CellValue,
  cityRaw: ExcelJS.CellValue,
  birthDateRaw: ExcelJS.CellValue,
  yearRaw: ExcelJS.CellValue,
):
  | { ok: true; row: CaravanImportRow; display: Omit<CaravanImportIssueRow, 'rowNumber' | 'reasons'> }
  | {
      ok: false;
      display: Omit<CaravanImportIssueRow, 'rowNumber' | 'reasons'>;
      reasons: string[];
    } {
  const caravanName = cellToText(caravanRaw).replace(/\s+/g, ' ').trim();
  let firstName = cellToText(firstRaw).replace(/\s+/g, ' ').trim();
  let lastName = cellToText(lastRaw).replace(/\s+/g, ' ').trim();
  if (!firstName && !lastName) {
    const fromFull = splitFullName(cellToText(firstRaw) || cellToText(lastRaw));
    firstName = fromFull.firstName;
    lastName = fromFull.lastName;
  }
  const nationalId = parseNationalId(nationalIdRaw);
  const phone = parsePhone(phoneRaw);
  const cityText = cellToText(cityRaw).replace(/\s+/g, ' ').trim();
  const birthDateText = birthDateDisplay(birthDateRaw);
  const parsedBirthDate = parseBirthDate(birthDateRaw);
  const year = parseYear(yearRaw);
  const yearText = cellToText(yearRaw);

  const display = issueDisplay({
    caravanName,
    firstName,
    lastName,
    nationalId,
    phone,
    city: cityText,
    birthDate: birthDateText,
    year: yearText,
  });

  const hardErrors: string[] = [];
  if (!caravanName || caravanName.length < 2) hardErrors.push('missingCaravanName');
  if (!phone) hardErrors.push('missingPhone');
  if (hardErrors.length) {
    return { ok: false, display, reasons: hardErrors };
  }

  const adjustments: string[] = [];
  let birthDate = parsedBirthDate;
  if (hasCellInput(birthDateRaw) && !parsedBirthDate) {
    birthDate = null;
    adjustments.push('clearedBirthDate');
  }

  return {
    ok: true,
    display,
    row: {
      rowNumber,
      caravanName,
      firstName,
      lastName,
      nationalId: nationalId || null,
      phone,
      cityName: cityText || null,
      birthDate,
      years: year ? [year] : [],
      adjustments,
    },
  };
}

type ReportIdentity = {
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phone: string;
  cityName: string | null;
  birthDate: string | null;
  birthDateText: string;
  yearText: string;
  clearedBirthDate: boolean;
};

type ReportGroup = {
  rowNumber: number;
  caravanName: string;
  managerFull: string;
  years: Set<number>;
  yearTexts: string[];
  identity: ReportIdentity | null;
};

function parseReportSheet(
  sheet: ExcelJS.Worksheet,
  cols: Partial<Record<ColKey, number>>,
): ParsedCaravanImport {
  const groups = new Map<string, ReportGroup>();
  const byPersonName = new Map<string, ReportIdentity>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const caravanName = cellToText(cellOf(row, cols.caravanName)).replace(/\s+/g, ' ').trim();
    const managerFull = cellToText(cellOf(row, cols.managerFull)).replace(/\s+/g, ' ').trim();
    const firstName = cellToText(cellOf(row, cols.rowFirst ?? cols.managerFirst)).replace(
      /\s+/g,
      ' ',
    ).trim();
    const lastName = cellToText(cellOf(row, cols.rowLast ?? cols.managerLast)).replace(
      /\s+/g,
      ' ',
    ).trim();
    const nationalId = parseNationalId(cellOf(row, cols.nationalId));
    const phone = parsePhone(cellOf(row, cols.phone));
    const cityText = cellToText(cellOf(row, cols.city)).replace(/\s+/g, ' ').trim();
    const birthRaw = cellOf(row, cols.birthDate);
    const birthDateText = birthDateDisplay(birthRaw);
    const parsedBirthDate = parseBirthDate(birthRaw);
    const year = parseYear(cellOf(row, cols.year));
    const yearText = cellToText(cellOf(row, cols.year));

    if (!caravanName && !managerFull && !nationalId && !phone) return;

    const clearedBirthDate = hasCellInput(birthRaw) && !parsedBirthDate;
    const identity: ReportIdentity | null = phone
      ? {
          firstName,
          lastName,
          nationalId: nationalId || null,
          phone,
          cityName: cityText || null,
          birthDate: parsedBirthDate,
          birthDateText,
          yearText,
          clearedBirthDate,
        }
      : null;

    const personKey = normalizePersonName(`${firstName} ${lastName}`);
    if (identity && personKey && !byPersonName.has(personKey)) {
      byPersonName.set(personKey, identity);
    }

    if (!caravanName || caravanName.length < 2) return;
    const key = normalizeCaravanNameKey(caravanName);
    let group = groups.get(key);
    if (!group) {
      group = {
        rowNumber,
        caravanName,
        managerFull,
        years: new Set(),
        yearTexts: [],
        identity: null,
      };
      groups.set(key, group);
    }
    if (managerFull && !group.managerFull) group.managerFull = managerFull;
    if (year) group.years.add(year);
    if (yearText) group.yearTexts.push(yearText);

    const managerKey = normalizePersonName(group.managerFull || managerFull);
    if (!group.identity && identity && personKey && personKey === managerKey) {
      group.identity = identity;
    }
  });

  const rows: CaravanImportRow[] = [];
  const invalidRows: CaravanImportIssueRow[] = [];
  const adjustedRows: CaravanImportIssueRow[] = [];

  for (const group of groups.values()) {
    const managerKey = normalizePersonName(group.managerFull);
    const identity =
      group.identity ?? (managerKey ? byPersonName.get(managerKey) ?? null : null);
    const names = identity
      ? { firstName: identity.firstName, lastName: identity.lastName }
      : splitFullName(group.managerFull);
    const yearLabel = [...group.years].sort((a, b) => a - b).join('، ');
    const display = issueDisplay({
      caravanName: group.caravanName,
      firstName: names.firstName,
      lastName: names.lastName,
      nationalId: identity?.nationalId ?? '',
      phone: identity?.phone ?? '',
      city: identity?.cityName ?? '',
      birthDate: identity?.birthDateText ?? '',
      year: yearLabel || group.yearTexts[0] || '',
    });

    const reasons: string[] = [];
    if (!identity?.phone) reasons.push('missingPhone');
    if (!names.firstName || !names.lastName) reasons.push('missingManagerName');
    if (reasons.length) {
      invalidRows.push({ rowNumber: group.rowNumber, ...display, reasons });
      continue;
    }

    const adjustments: string[] = [];
    if (identity?.clearedBirthDate) adjustments.push('clearedBirthDate');

    const row: CaravanImportRow = {
      rowNumber: group.rowNumber,
      caravanName: group.caravanName,
      firstName: names.firstName,
      lastName: names.lastName,
      nationalId: identity!.nationalId,
      phone: identity!.phone,
      cityName: identity?.cityName ?? null,
      birthDate: identity?.birthDate ?? null,
      years: [...group.years].sort((a, b) => a - b),
      adjustments,
    };
    rows.push(row);
    if (adjustments.length) {
      adjustedRows.push({ rowNumber: group.rowNumber, ...display, reasons: adjustments });
    }
  }

  rows.sort((a, b) => a.rowNumber - b.rowNumber);
  invalidRows.sort((a, b) => a.rowNumber - b.rowNumber);
  adjustedRows.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    rows,
    invalid: invalidRows.length,
    invalidRows,
    adjusted: adjustedRows.length,
    adjustedRows,
  };
}

function parseDedicatedSheet(
  sheet: ExcelJS.Worksheet,
  cols: {
    caravanName: number;
    firstName: number;
    lastName: number;
    nationalId: number;
    phone: number;
    city: number;
    birthDate: number;
    year: number;
  },
  skipHeader: boolean,
): ParsedCaravanImport {
  const rows: CaravanImportRow[] = [];
  const invalidRows: CaravanImportIssueRow[] = [];
  const adjustedRows: CaravanImportIssueRow[] = [];
  const merged = new Map<string, CaravanImportRow>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (skipHeader && rowNumber === 1) return;
    const parsed = toDedicatedRow(
      rowNumber,
      row.getCell(cols.caravanName).value,
      row.getCell(cols.firstName).value,
      row.getCell(cols.lastName).value,
      row.getCell(cols.nationalId).value,
      row.getCell(cols.phone).value,
      row.getCell(cols.city).value,
      row.getCell(cols.birthDate).value,
      row.getCell(cols.year).value,
    );
    const empty =
      !cellToText(row.getCell(cols.caravanName).value) &&
      !cellToText(row.getCell(cols.nationalId).value) &&
      !cellToText(row.getCell(cols.phone).value);
    if (empty) return;

    if (parsed.ok === false) {
      invalidRows.push({
        rowNumber,
        ...parsed.display,
        reasons: parsed.reasons,
      });
      return;
    }

    const key = normalizeCaravanNameKey(parsed.row.caravanName);
    const existing = merged.get(key);
    if (existing) {
      for (const year of parsed.row.years) {
        if (!existing.years.includes(year)) existing.years.push(year);
      }
      existing.years.sort((a, b) => a - b);
      return;
    }
    merged.set(key, parsed.row);
    rows.push(parsed.row);
    if (parsed.row.adjustments.length) {
      adjustedRows.push({
        rowNumber,
        ...parsed.display,
        reasons: parsed.row.adjustments,
      });
    }
  });

  return {
    rows,
    invalid: invalidRows.length,
    invalidRows,
    adjusted: adjustedRows.length,
    adjustedRows,
  };
}

export async function parseCaravanImportExcel(
  buffer: Buffer,
): Promise<ParsedCaravanImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], invalid: 0, invalidRows: [], adjusted: 0, adjustedRows: [] };
  }

  const headerCols = sheet.getRow(1) ? detectColumns(sheet.getRow(1)) : null;
  const isReport = Boolean(headerCols?.managerFull && headerCols.caravanName);

  if (isReport && headerCols) {
    return parseReportSheet(sheet, headerCols);
  }

  if (headerCols) {
    return parseDedicatedSheet(
      sheet,
      {
        caravanName: headerCols.caravanName ?? DEFAULT_COLUMNS.caravanName,
        firstName:
          headerCols.managerFirst ?? headerCols.rowFirst ?? DEFAULT_COLUMNS.managerFirst,
        lastName:
          headerCols.managerLast ?? headerCols.rowLast ?? DEFAULT_COLUMNS.managerLast,
        nationalId: headerCols.nationalId ?? DEFAULT_COLUMNS.nationalId,
        phone: headerCols.phone ?? DEFAULT_COLUMNS.phone,
        city: headerCols.city ?? DEFAULT_COLUMNS.city,
        birthDate: headerCols.birthDate ?? DEFAULT_COLUMNS.birthDate,
        year: headerCols.year ?? DEFAULT_COLUMNS.year,
      },
      true,
    );
  }

  return parseDedicatedSheet(
    sheet,
    {
      caravanName: DEFAULT_COLUMNS.caravanName,
      firstName: DEFAULT_COLUMNS.managerFirst,
      lastName: DEFAULT_COLUMNS.managerLast,
      nationalId: DEFAULT_COLUMNS.nationalId,
      phone: DEFAULT_COLUMNS.phone,
      city: DEFAULT_COLUMNS.city,
      birthDate: DEFAULT_COLUMNS.birthDate,
      year: DEFAULT_COLUMNS.year,
    },
    false,
  );
}

export function normalizeCityLookupKey(value: string) {
  return toLatinDigits(value)
    .replace(/\u200c/g, '')
    .replace(/[()]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export function cityLookupKeys(nameFa: string, nameEn: string) {
  const keys = [normalizeCityLookupKey(nameFa), normalizeCityLookupKey(nameEn)];
  const fa = toLatinDigits(nameFa)
    .replace(/\u200c/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
  const mashhadDistrict = fa.match(/^مشهد\s+(\d+)$/);
  if (mashhadDistrict) {
    keys.push(normalizeCityLookupKey(`منطقه ${mashhadDistrict[1]}`));
  }
  if (fa === 'مشهد ثامن' || fa === 'مشهد 8') {
    keys.push(normalizeCityLookupKey('منطقه 8 (ثامن)'));
    keys.push(normalizeCityLookupKey('ثامن'));
  }
  if (fa === 'آشخانه' || fa === 'سملقان') {
    keys.push(normalizeCityLookupKey('مانه و سملقان'));
  }
  const parts = fa.split(/\s+/);
  const lastPart = parts[parts.length - 1] ?? '';
  if (
    parts.length > 1 &&
    parts[0].length >= 3 &&
    !/^\d+$/.test(lastPart) &&
    !/ثامن|منطقه/.test(fa)
  ) {
    keys.push(normalizeCityLookupKey(parts[0]));
  }
  return keys.filter(Boolean);
}
