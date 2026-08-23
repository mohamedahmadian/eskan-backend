import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import {
  isValidIranianNationalId,
  normalizeNationalId,
  toLatinDigits,
} from '../common/national-id';
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
  errors: string[];
  duplicateOfRow?: number;
};

type ColumnKey =
  | 'nationalId'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'gender'
  | 'birthDate';

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  nationalId: ['کدملی', 'nationalcode', 'nationalid', 'national_code'],
  firstName: ['نام', 'firstname', 'first_name'],
  lastName: ['نامخانوادگی', 'lastname', 'last_name'],
  phone: ['تلفن', 'تلفنهمراه', 'شمارهموبایل', 'phone', 'mobile'],
  gender: ['جنسیت', 'gender'],
  birthDate: ['تاریخولد', 'birthdate', 'birth_date', 'birthdate'],
};

const DEFAULT_COLUMNS: Record<ColumnKey, number> = {
  nationalId: 1,
  firstName: 2,
  lastName: 3,
  phone: 4,
  gender: 5,
  birthDate: 6,
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

function jalaliToIso(jy: number, jm: number, jd: number): string | null {
  if (jy < 1200 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
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

function parseBirthDate(value: ExcelJS.CellValue): string | null {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return dateToIso(raw);
  if (typeof raw === 'number') return excelSerialToIso(raw);

  const text = toLatinDigits(String(raw).trim()).replace(/[٫.]/g, '/');
  if (!text) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parts = text.split(/[/\\-]/).map((part) => Number(part));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [y, m, d] = parts;
    if (y >= 1700) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return jalaliToIso(y, m, d);
  }
  return null;
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
  cells: Record<ColumnKey, ExcelJS.CellValue>,
): ParsedMemberImportRow {
  const firstName = cellToText(cells.firstName);
  const lastName = cellToText(cells.lastName);
  const genderText = cellToText(cells.gender);
  const gender = parseMemberGender(genderText);
  const phoneRaw = cellToText(cells.phone).replace(/\s+/g, '');
  const phone = phoneRaw ? normalizePhone(phoneRaw) : '';
  const nationalRaw = cellToText(cells.nationalId).replace(/\s+/g, '');
  const nationalId = nationalRaw ? normalizeNationalId(nationalRaw) : '';
  const birthDateText = hasCellInput(cells.birthDate)
    ? cellToText(cells.birthDate) || (parseBirthDate(cells.birthDate) ?? '')
    : '';
  const birthDate = hasCellInput(cells.birthDate)
    ? parseBirthDate(cells.birthDate)
    : null;

  const errors: string[] = [];
  if (!nationalId) errors.push('missingNationalId');
  else if (!isValidIranianNationalId(nationalId)) errors.push('invalidNationalId');
  if (!firstName) errors.push('missingFirstName');
  if (!lastName) errors.push('missingLastName');
  if (!genderText) errors.push('missingGender');
  else if (!gender) errors.push('invalidGender');
  if (phone && !isValidOptionalPhone(phone)) errors.push('invalidPhone');
  if (hasCellInput(cells.birthDate) && !birthDate) errors.push('invalidBirthDate');

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
    const texts = [1, 2, 3, 4, 5, 6, 7, 8].map((col) =>
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
        nationalId: row.getCell(columns.nationalId).value,
        firstName: row.getCell(columns.firstName).value,
        lastName: row.getCell(columns.lastName).value,
        phone: row.getCell(columns.phone).value,
        gender: row.getCell(columns.gender).value,
        birthDate: row.getCell(columns.birthDate).value,
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
