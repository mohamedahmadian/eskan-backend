import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import {
  isValidIranianNationalId,
  normalizeNationalId,
  toLatinDigits,
} from '../common/national-id';
import { jalaliToIsoDate } from '../common/jalali-year';
import { normalizePhone } from '../common/phone';
import { UserGender } from '../generated/prisma/client';

export const MEMBER_IMPORT_MAX_ROWS = 200;
export const MEMBER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export type MemberImportRowStatus = 'VALID' | 'INVALID' | 'DUPLICATE';
export type MemberImportUserState = 'NEW' | 'EXISTING' | 'ALREADY_MEMBER';

export type ParsedMemberImportRow = {
  rowNumber: number;
  nationalId: string;
  firstName: string;
  lastName: string;
  gender: UserGender | null;
  genderText: string;
  phone: string;
  birthDate: string | null;
  birthDateText: string;
  requestsSimCard: boolean;
  requestsBankCard: boolean;
  errors: string[];
  duplicateOfRow?: number;
};

type ColumnKey =
  | 'nationalId'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'gender'
  | 'birthDate'
  | 'requestsSimCard'
  | 'requestsBankCard';

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  nationalId: ['کدملی', 'nationalcode', 'nationalid', 'national_code'],
  firstName: ['نام', 'firstname', 'first_name'],
  lastName: ['نامخانوادگی', 'lastname', 'last_name'],
  phone: ['تلفن', 'تلفنهمراه', 'شمارههمراه', 'شمارهموبایل', 'موبایل', 'همراه', 'phone', 'mobile'],
  gender: ['جنسیت', 'gender'],
  birthDate: ['تاریخولد', 'تاریختولد', 'متولد', 'birthdate', 'birth_date'],
  requestsSimCard: [
    'متقاضیسیمکارت',
    'سیمکارت',
    'simcard',
    'requestssimcard',
  ],
  requestsBankCard: [
    'متقاضیکارتبانکی',
    'کارتبانکی',
    'bankcard',
    'requestsbankcard',
  ],
};

const DEFAULT_COLUMNS: Record<ColumnKey, number> = {
  nationalId: 1,
  firstName: 2,
  lastName: 3,
  phone: 4,
  gender: 5,
  birthDate: 6,
  requestsSimCard: 7,
  requestsBankCard: 8,
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
  if (raw instanceof Date) return dateToIso(raw) ?? '';
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

function cellDisplayText(cell: ExcelJS.Cell): string {
  try {
    const text = cell.text;
    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
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

function parseBirthDate(value: ExcelJS.CellValue, displayText?: string): string | null {
  for (const text of [
    displayText,
    typeof cellToRaw(value) === 'string' ? String(cellToRaw(value)) : '',
  ]) {
    if (!text) continue;
    const parsed = parseBirthDateText(text);
    if (parsed) return parsed;
  }

  const raw = cellToRaw(value);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const year = raw.getUTCFullYear();
    if (year >= 1200 && year <= 1600) {
      return jalaliToIsoDate(year, raw.getUTCMonth() + 1, raw.getUTCDate());
    }
    return dateToIso(raw);
  }
  if (typeof raw === 'number') {
    return excelSerialToIso(raw);
  }
  return null;
}

function parsePhone(value: ExcelJS.CellValue, displayText?: string): string {
  const candidates = [displayText, cellToText(value)].filter(Boolean);
  for (const text of candidates) {
    const digits = toLatinDigits(text).replace(/\D/g, '');
    if (!digits) continue;
    const normalized =
      digits.length === 10 && digits.startsWith('9') ? `0${digits}` : digits;
    return normalizePhone(normalized);
  }
  return '';
}

function hasCellInput(value: ExcelJS.CellValue) {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return false;
  if (raw instanceof Date) return true;
  if (typeof raw === 'number') return Number.isFinite(raw);
  return String(raw).trim().length > 0;
}

export function parseMemberGender(value: string): UserGender | null {
  const text = toLatinDigits(value).toLowerCase().replace(/\s+/g, '');
  if (!text) return null;
  if (
    text === 'male' ||
    text === 'm' ||
    text === 'مرد' ||
    text === 'آقا' ||
    text === 'اقا' ||
    text === 'م'
  ) {
    return UserGender.MALE;
  }
  if (
    text === 'female' ||
    text === 'f' ||
    text === 'زن' ||
    text === 'خانم' ||
    text === 'ز'
  ) {
    return UserGender.FEMALE;
  }
  return null;
}

function parseYesFlag(value: ExcelJS.CellValue): boolean {
  const text = toLatinDigits(cellToText(value))
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/\s+/g, '');
  if (!text) return false;
  return (
    text === '1' ||
    text === 'true' ||
    text === 'yes' ||
    text === 'y' ||
    text === 'بله' ||
    text === 'بلی' ||
    text === 'آری' ||
    text === 'اری'
  );
}

function isValidOptionalPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return true;
  if (digits.length === 11 && digits.startsWith('09')) return true;
  if (digits.length === 10 && digits.startsWith('9')) return true;
  if (digits.length === 12 && digits.startsWith('989')) return true;
  return false;
}

function matchColumn(header: string): ColumnKey | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [ColumnKey, string[]]
  >) {
    if (aliases.includes(normalized)) return key;
  }
  return null;
}

function resolveColumns(firstRow: string[]): Record<ColumnKey, number> | null {
  const mapped: Partial<Record<ColumnKey, number>> = {};
  firstRow.forEach((header, index) => {
    const key = matchColumn(header);
    if (key && mapped[key] == null) mapped[key] = index + 1;
  });
  const hits = Object.keys(mapped).length;
  if (hits === 0) return null;
  if (!mapped.nationalId || !mapped.firstName || !mapped.lastName || !mapped.gender) {
    throw new BadRequestException('از فایل نمونه استفاده کنید');
  }
  return { ...DEFAULT_COLUMNS, ...mapped };
}

function parseRow(
  rowNumber: number,
  cells: Record<ColumnKey, ExcelJS.Cell>,
): ParsedMemberImportRow {
  const firstName = cellToText(cells.firstName.value);
  const lastName = cellToText(cells.lastName.value);
  const genderText = cellToText(cells.gender.value);
  const gender = parseMemberGender(genderText);
  const phone = parsePhone(cells.phone.value, cellDisplayText(cells.phone));
  const nationalRaw = cellToText(cells.nationalId.value).replace(/\s+/g, '');
  const nationalId = nationalRaw ? normalizeNationalId(nationalRaw) : '';
  const birthDisplay = cellDisplayText(cells.birthDate);
  const birthDateText = hasCellInput(cells.birthDate.value)
    ? birthDisplay ||
      cellToText(cells.birthDate.value) ||
      (parseBirthDate(cells.birthDate.value, birthDisplay) ?? '')
    : '';
  const birthDate = hasCellInput(cells.birthDate.value)
    ? parseBirthDate(cells.birthDate.value, birthDisplay)
    : null;

  const errors: string[] = [];
  if (!nationalId) errors.push('missingNationalId');
  else if (!isValidIranianNationalId(nationalId)) errors.push('invalidNationalId');
  if (!firstName) errors.push('missingFirstName');
  if (!lastName) errors.push('missingLastName');
  if (!genderText) errors.push('missingGender');
  else if (!gender) errors.push('invalidGender');
  if (phone && !isValidOptionalPhone(phone)) errors.push('invalidPhone');
  if (hasCellInput(cells.birthDate.value) && !birthDate) errors.push('invalidBirthDate');

  return {
    rowNumber,
    nationalId,
    firstName,
    lastName,
    gender,
    genderText,
    phone,
    birthDate,
    birthDateText,
    requestsSimCard: parseYesFlag(cells.requestsSimCard.value),
    requestsBankCard: parseYesFlag(cells.requestsBankCard.value),
    errors,
  };
}

export async function parseReservationMemberExcel(
  buffer: Buffer,
): Promise<ParsedMemberImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('از فایل نمونه استفاده کنید');
  }

  const rows: ParsedMemberImportRow[] = [];
  let columns = DEFAULT_COLUMNS;
  let headerResolved = false;
  let dataCount = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const texts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) =>
      cellToText(row.getCell(col).value),
    );
    if (!headerResolved) {
      headerResolved = true;
      const detected = resolveColumns(texts);
      if (detected) {
        columns = detected;
        return;
      }
    }

    const empty = Object.values(columns).every((col) => !cellToText(row.getCell(col).value));
    if (empty) return;

    dataCount += 1;
    if (dataCount > MEMBER_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `حداکثر ${MEMBER_IMPORT_MAX_ROWS} ردیف در هر فایل مجاز است`,
      );
    }

    rows.push(
      parseRow(rowNumber, {
        nationalId: row.getCell(columns.nationalId),
        firstName: row.getCell(columns.firstName),
        lastName: row.getCell(columns.lastName),
        phone: row.getCell(columns.phone),
        gender: row.getCell(columns.gender),
        birthDate: row.getCell(columns.birthDate),
        requestsSimCard: row.getCell(columns.requestsSimCard),
        requestsBankCard: row.getCell(columns.requestsBankCard),
      }),
    );
  });

  const firstByNationalId = new Map<string, number>();
  for (const row of rows) {
    if (!row.nationalId || row.errors.includes('invalidNationalId')) continue;
    const first = firstByNationalId.get(row.nationalId);
    if (first == null) {
      firstByNationalId.set(row.nationalId, row.rowNumber);
      continue;
    }
    row.errors.push('duplicateInFile');
    row.duplicateOfRow = first;
  }

  return rows;
}
