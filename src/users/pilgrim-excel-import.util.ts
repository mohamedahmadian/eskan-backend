import * as ExcelJS from 'exceljs';
import { UserGender } from '../generated/prisma/client';

export type PilgrimImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  gender: UserGender;
  phone: string;
  nationalId: string | null;
  birthDate: string | null;
  cityName: string | null;
  cityId?: string | null;
  adjustments: string[];
};

export type PilgrimImportIssueRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  nationalId: string;
  birthDate: string;
  city: string;
  reasons: string[];
};

/** @deprecated alias kept for local clarity */
export type PilgrimImportInvalidRow = PilgrimImportIssueRow;

export type ParsedPilgrimImport = {
  rows: PilgrimImportRow[];
  invalid: number;
  invalidRows: PilgrimImportIssueRow[];
  adjusted: number;
  adjustedRows: PilgrimImportIssueRow[];
};

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - '٠'.charCodeAt(0)));
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
    const iso = dateToIso(raw);
    return iso ?? '';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return normalizeDigits(String(raw).trim());
  }
  return normalizeDigits(String(raw).trim());
}

function birthDateDisplay(value: ExcelJS.CellValue): string {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return '';
  if (raw instanceof Date) return dateToIso(raw) ?? '';
  if (typeof raw === 'number') return excelSerialToIso(raw) ?? String(raw);
  return normalizeDigits(String(raw).trim());
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

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function dateToIso(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseBirthDate(value: ExcelJS.CellValue): string | null {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return dateToIso(raw);
  if (typeof raw === 'number') return excelSerialToIso(raw);

  const text = normalizeDigits(String(raw).trim()).replace(/[٫.]/g, '/');
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

function parseGender(value: ExcelJS.CellValue): UserGender | null {
  const text = cellToText(value).toLowerCase().replace(/\s+/g, '');
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

function isHeaderRow(values: string[]) {
  const joined = values.join(' ').toLowerCase();
  return /نام|first|جنسیت|gender|کد\s*ملی|national|تلفن|phone|تاریخ|birth|شهر|city/.test(
    joined,
  );
}

function hasBirthDateInput(value: ExcelJS.CellValue) {
  const raw = cellToRaw(value);
  if (raw == null || raw === '') return false;
  if (raw instanceof Date) return true;
  if (typeof raw === 'number') return Number.isFinite(raw);
  return String(raw).trim().length > 0;
}

type RowParseResult =
  | { ok: true; row: PilgrimImportRow; display: Omit<PilgrimImportIssueRow, 'rowNumber' | 'reasons'> }
  | {
      ok: false;
      display: Omit<PilgrimImportIssueRow, 'rowNumber' | 'reasons'>;
      reasons: string[];
    };

function toImportRow(
  rowNumber: number,
  firstNameRaw: ExcelJS.CellValue,
  lastNameRaw: ExcelJS.CellValue,
  genderRaw: ExcelJS.CellValue,
  phoneRaw: ExcelJS.CellValue,
  nationalIdRaw: ExcelJS.CellValue,
  birthDateRaw: ExcelJS.CellValue,
  cityRaw: ExcelJS.CellValue,
): RowParseResult {
  const firstName = cellToText(firstNameRaw);
  const lastName = cellToText(lastNameRaw);
  const genderText = cellToText(genderRaw);
  const parsedGender = parseGender(genderRaw);
  const phone = cellToText(phoneRaw).replace(/\s+/g, '');
  const nationalIdRawText = cellToText(nationalIdRaw).replace(/\s+/g, '');
  const nationalId = nationalIdRawText || null;
  const birthDateText = birthDateDisplay(birthDateRaw);
  const parsedBirthDate = parseBirthDate(birthDateRaw);
  const cityText = cellToText(cityRaw);
  const cityName = cityText || null;

  const hardErrors: string[] = [];
  if (!firstName) hardErrors.push('missingFirstName');
  if (!lastName) hardErrors.push('missingLastName');
  if (!phone) hardErrors.push('missingPhone');

  const display = {
    firstName,
    lastName,
    gender: genderText,
    phone,
    nationalId: nationalIdRawText,
    birthDate: birthDateText,
    city: cityText,
  };

  if (hardErrors.length) {
    return { ok: false, display, reasons: hardErrors };
  }

  const adjustments: string[] = [];
  let gender = parsedGender;
  if (!gender) {
    gender = UserGender.MALE;
    adjustments.push('defaultGenderMale');
  }

  let birthDate = parsedBirthDate;
  if (hasBirthDateInput(birthDateRaw) && !parsedBirthDate) {
    birthDate = null;
    adjustments.push('clearedBirthDate');
  }

  return {
    ok: true,
    display,
    row: {
      rowNumber,
      firstName,
      lastName,
      gender,
      phone,
      nationalId,
      birthDate,
      cityName,
      adjustments,
    },
  };
}

export async function parsePilgrimImportExcel(
  buffer: Buffer,
): Promise<ParsedPilgrimImport> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect a narrower Buffer shape than Node's Buffer
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], invalid: 0, invalidRows: [], adjusted: 0, adjustedRows: [] };
  }

  const rows: PilgrimImportRow[] = [];
  const invalidRows: PilgrimImportIssueRow[] = [];
  const adjustedRows: PilgrimImportIssueRow[] = [];
  let started = false;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [1, 2, 3, 4, 5, 6, 7].map((col) =>
      cellToText(row.getCell(col).value),
    );
    if (!started) {
      if (rowNumber === 1 && isHeaderRow(values)) {
        return;
      }
      started = true;
    }

    const empty =
      values.every((value) => !value) && !row.getCell(6).value && !row.getCell(7).value;
    if (empty) return;

    const parsed = toImportRow(
      rowNumber,
      row.getCell(1).value,
      row.getCell(2).value,
      row.getCell(3).value,
      row.getCell(4).value,
      row.getCell(5).value,
      row.getCell(6).value,
      row.getCell(7).value,
    );
    if (parsed.ok === false) {
      invalidRows.push({
        rowNumber,
        ...parsed.display,
        reasons: parsed.reasons,
      });
      return;
    }
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
