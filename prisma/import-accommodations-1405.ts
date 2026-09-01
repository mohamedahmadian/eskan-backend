import 'dotenv/config';
import { join } from 'node:path';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccommodationType,
  GenderType,
  ManagementType,
  PrismaClient,
  UserStatus,
} from '../src/generated/prisma/client';
import { toLatinDigits } from '../src/common/national-id';
import { normalizeMobile, phoneLookupValues } from '../src/common/phone';
import { joinFullName, splitFullName } from '../src/users/user-profile.util';

const YEAR = 1405;
const DEFAULT_PASSWORD = '11111111';
const FILE_PATH = join(__dirname, 'eskan1405.xlsx');

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

type ManagerDraft = {
  firstName: string;
  lastName: string;
  phone: string;
};

type VenueDraft = {
  name: string;
  type: AccommodationType;
  genderType: GenderType;
  managementType: ManagementType;
  maleCapacity: number;
  femaleCapacity: number;
  address: string | null;
  managers: ManagerDraft[];
  rowNumbers: number[];
};

function cellToRaw(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (typeof value === 'object') {
    if ('result' in value) return cellToRaw(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') return value.text;
  }
  return value;
}

function cellToText(value: ExcelJS.CellValue): string {
  const raw = cellToRaw(value);
  if (raw == null) return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return toLatinDigits(String(raw)).trim();
  }
  return toLatinDigits(String(raw)).trim();
}

function normalizeName(value: string) {
  return value
    .replace(/\u200c/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferType(name: string): AccommodationType {
  const compact = name.replace(/\s+/g, '');
  if (compact.includes('مسجد')) return 'MOSQUE';
  if (compact.includes('حسینیه')) return 'HUSSEINIEH';
  if (compact.includes('سالن')) return 'HALL';
  if (compact.includes('منزل')) return 'HOUSE';
  if (
    /دبستان|دبیرستان|هنرستان|مدرسه|شاهد/.test(compact)
  ) {
    return 'SCHOOL';
  }
  return 'OTHER';
}

function parseGender(raw: string): GenderType | null {
  const value = normalizeName(raw).replace(/\s+/g, '');
  if (!value || value === '-' || value === '—') return null;
  if (/^زن|خانم|خواهر/.test(value)) return 'FEMALE';
  if (/^مرد|آقا|اقایان|آقایان/.test(value)) return 'MALE';
  if (value.includes('مختلط')) return 'MIXED';
  return null;
}

function parseManagement(raw: string): ManagementType {
  const value = normalizeName(raw).replace(/\s+/g, '');
  if (value.includes('غیرخودکفا')) return 'NON_SELF_SUFFICIENT';
  if (value.includes('نیمهخودکفا') || value.includes('نیمه‌خودکفا')) {
    return 'SEMI_SELF_SUFFICIENT';
  }
  return 'SELF_SUFFICIENT';
}

function parseCapacity(raw: string): number {
  const digits = toLatinDigits(raw).replace(/[^\d]/g, '');
  if (!digits) return 0;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function parsePhone(raw: string): string | null {
  const phone = normalizeMobile(raw);
  return /^09\d{9}$/.test(phone) ? phone : null;
}

function managerFromRow(
  firstNameRaw: string,
  lastNameRaw: string,
  phone1: string,
  phone2: string,
): ManagerDraft | null {
  const phone = parsePhone(phone1) ?? parsePhone(phone2);
  const first = firstNameRaw.trim();
  const last = lastNameRaw.trim();
  if (!phone && !first && !last) return null;
  if (!phone) return null;
  if (first && last) {
    return { firstName: first, lastName: last, phone };
  }
  if (!first && last) {
    const split = splitFullName(last);
    return { firstName: split.firstName, lastName: split.lastName, phone };
  }
  if (first && !last) {
    const split = splitFullName(first);
    return { firstName: split.firstName, lastName: split.lastName, phone };
  }
  return { firstName: 'مدیر', lastName: 'اسکان', phone };
}

function sheetKey(name: string) {
  return normalizeName(name).replace(/\s+/g, '');
}

function findAccommodationSheet(workbook: ExcelJS.Workbook) {
  const match = workbook.worksheets.find((item) => {
    const key = sheetKey(item.name);
    return key.includes('لیستاسکان') && !key.includes('جدید');
  });
  if (!match) {
    const names = workbook.worksheets.map((item) => item.name).join('، ');
    throw new Error(`شیت «لیست اسکان» پیدا نشد. شیت‌های موجود: ${names}`);
  }
  return match;
}

function headerIndex(sheet: ExcelJS.Worksheet) {
  let headerRow = 1;
  let map = new Map<string, number>();
  const maxScan = Math.min(8, sheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const next = new Map<string, number>();
    sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = normalizeName(cellToText(cell.value)).replace(/\s+/g, '');
      if (key) next.set(key, col);
    });
    if (next.has('ناماسکان') && next.has('جنسیت') && next.has('ظرفیت')) {
      headerRow = rowNumber;
      map = next;
      break;
    }
  }
  const col = (...aliases: string[]) => {
    for (const alias of aliases) {
      const found = map.get(alias);
      if (found) return found;
    }
    return null;
  };
  return {
    headerRow,
    name: col('ناماسکان'),
    firstName: col('ناممدیر'),
    lastName: col('نامخانوادگیمدیر'),
    phone1: col('شمارهموبایل۱', 'شمارهموبایل1'),
    phone2: col('شمارهموبایل۲', 'شمارهموبایل2'),
    gender: col('جنسیت'),
    capacity: col('ظرفیت'),
    food: col('وضعیتتغذیه'),
    address: col('آدرس'),
  };
}

function isDataName(name: string) {
  const compact = name.replace(/\s+/g, '');
  if (!compact) return false;
  if (compact === 'ناماسکان') return false;
  if (compact.includes('لیستاسکان')) return false;
  if (compact.includes('تعدادکل')) return false;
  return true;
}

function collectVenues(sheet: ExcelJS.Worksheet): VenueDraft[] {
  const cols = headerIndex(sheet);
  if (!cols.name || !cols.gender || !cols.capacity) {
    throw new Error(`ستون‌های ضروری در شیت «${sheet.name}» پیدا نشد`);
  }
  const byName = new Map<string, VenueDraft>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= cols.headerRow) return;
    const name = normalizeName(cellToText(row.getCell(cols.name!).value));
    if (!isDataName(name)) return;

    const gender = parseGender(cellToText(row.getCell(cols.gender!).value));
    const capacity = parseCapacity(cellToText(row.getCell(cols.capacity!).value));
    const managementType = parseManagement(
      cols.food ? cellToText(row.getCell(cols.food).value) : '',
    );
    const address = cols.address
      ? normalizeName(cellToText(row.getCell(cols.address).value)) || null
      : null;
    const manager = managerFromRow(
      cols.firstName ? cellToText(row.getCell(cols.firstName).value) : '',
      cols.lastName ? cellToText(row.getCell(cols.lastName).value) : '',
      cols.phone1 ? cellToText(row.getCell(cols.phone1).value) : '',
      cols.phone2 ? cellToText(row.getCell(cols.phone2).value) : '',
    );

    const key = name.replace(/\s+/g, '').toLowerCase();
    const current = byName.get(key) ?? {
      name,
      type: inferType(name),
      genderType: gender ?? 'MIXED',
      managementType,
      maleCapacity: 0,
      femaleCapacity: 0,
      address,
      managers: [],
      rowNumbers: [],
    };
    current.rowNumbers.push(rowNumber);
    if (!current.address && address) current.address = address;
    if (current.managementType === 'SELF_SUFFICIENT' && managementType !== 'SELF_SUFFICIENT') {
      current.managementType = managementType;
    }
    if (gender === 'FEMALE') current.femaleCapacity += capacity;
    else if (gender === 'MALE') current.maleCapacity += capacity;
    else if (capacity > 0) current.maleCapacity += capacity;
    if (manager && !current.managers.some((item) => item.phone === manager.phone)) {
      current.managers.push(manager);
    }
    if (current.maleCapacity > 0 && current.femaleCapacity > 0) {
      current.genderType = 'MIXED';
    } else if (current.femaleCapacity > 0) {
      current.genderType = 'FEMALE';
    } else if (current.maleCapacity > 0) {
      current.genderType = 'MALE';
    } else {
      current.genderType = gender ?? 'MIXED';
    }
    byName.set(key, current);
  });

  return [...byName.values()];
}

async function resolveMashhad() {
  const country = await prisma.country.findUnique({
    where: { iso2: 'IR' },
    select: { id: true },
  });
  if (!country) throw new Error('کشور ایران در سامانه یافت نشد');

  const city = await prisma.city.findFirst({
    where: {
      isActive: true,
      OR: [
        { nameFa: 'مشهد' },
        { nameEn: { equals: 'Mashhad', mode: 'insensitive' } },
      ],
    },
    select: { id: true, provinceId: true },
  });
  if (!city) throw new Error('شهر مشهد در سامانه یافت نشد');
  return { countryId: country.id, provinceId: city.provinceId, cityId: city.id };
}

async function loadExistingUsers(phones: string[]) {
  const byPhone = new Map<string, { id: string; phone: string | null }>();
  const unique = [...new Set(phones)];
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const variants = chunk.flatMap((phone) => phoneLookupValues(phone));
    const found = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: variants } },
          { username: { in: chunk } },
        ],
      },
      select: { id: true, phone: true, username: true },
    });
    for (const user of found) {
      for (const value of phoneLookupValues(user.phone ?? '')) {
        byPhone.set(value, user);
      }
      byPhone.set(user.username, user);
    }
  }
  return byPhone;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FILE_PATH);
  const sheet = findAccommodationSheet(workbook);

  const venues = collectVenues(sheet);
  if (!venues.length) throw new Error('هیچ محل اسکان معتبری در فایل نبود');

  const roles = await prisma.role.findMany({
    where: { code: 'ACCOMMODATION_MANAGER' },
    select: { id: true, code: true },
  });
  const managerRoleId = roles.find((item) => item.code === 'ACCOMMODATION_MANAGER')?.id;
  if (!managerRoleId) throw new Error('نقش مدیر اسکان یافت نشد');

  const mashhad = await resolveMashhad();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 8);
  const phones = venues.flatMap((venue) => venue.managers.map((item) => item.phone));
  const usersByPhone = await loadExistingUsers(phones);

  const existingAccommodations = await prisma.accommodation.findMany({
    select: { id: true, name: true },
  });
  const accommodationByName = new Map(
    existingAccommodations.map((item) => [
      normalizeName(item.name).replace(/\s+/g, '').toLowerCase(),
      item,
    ]),
  );

  const stats = {
    accommodationsCreated: 0,
    accommodationsReused: 0,
    usersCreated: 0,
    usersReused: 0,
    managersLinked: 0,
    withoutManager: 0,
  };

  for (const venue of venues) {
    const key = normalizeName(venue.name).replace(/\s+/g, '').toLowerCase();
    let accommodationId = accommodationByName.get(key)?.id;
    const venuePhone = venue.managers[0]?.phone ?? null;
    const data = {
      name: venue.name,
      type: venue.type,
      status: 'ACTIVE' as const,
      genderType: venue.genderType,
      managementType: venue.managementType,
      maleCapacity: venue.maleCapacity,
      femaleCapacity: venue.femaleCapacity,
      phone: venuePhone,
      address: venue.address,
      countryId: mashhad.countryId,
      provinceId: mashhad.provinceId,
      cityId: mashhad.cityId,
    };

    if (accommodationId) {
      await prisma.accommodation.update({
        where: { id: accommodationId },
        data,
      });
      stats.accommodationsReused += 1;
    } else {
      const created = await prisma.accommodation.create({ data });
      accommodationId = created.id;
      accommodationByName.set(key, created);
      stats.accommodationsCreated += 1;
    }

    const managerIds: string[] = [];
    for (const manager of venue.managers) {
      const lookupKeys = [
        manager.phone,
        ...phoneLookupValues(manager.phone),
      ];
      let user = lookupKeys.map((item) => usersByPhone.get(item)).find(Boolean);
      if (!user) {
        let username = manager.phone;
        const usernameTaken = await prisma.user.findUnique({
          where: { username },
          select: { id: true },
        });
        if (usernameTaken) {
          username = `${manager.phone}_${Date.now().toString(36)}`;
        }
        try {
          const created = await prisma.user.create({
            data: {
              username,
              passwordHash,
              firstName: manager.firstName,
              lastName: manager.lastName,
              fullName: joinFullName(manager.firstName, manager.lastName),
              locale: 'fa',
              status: UserStatus.ACTIVE,
              phone: manager.phone,
              countryId: mashhad.countryId,
              provinceId: mashhad.provinceId,
              cityId: mashhad.cityId,
            },
            select: { id: true, phone: true },
          });
          user = created;
          usersByPhone.set(manager.phone, created);
          stats.usersCreated += 1;
        } catch {
          const existing = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: { in: phoneLookupValues(manager.phone) } },
                { username: manager.phone },
              ],
            },
            select: { id: true, phone: true },
          });
          if (!existing) {
            throw new Error(`ثبت کاربر برای ${manager.phone} ناموفق بود`);
          }
          user = existing;
          usersByPhone.set(manager.phone, existing);
          stats.usersReused += 1;
        }
      } else {
        stats.usersReused += 1;
      }

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: managerRoleId } },
        update: {},
        create: { userId: user.id, roleId: managerRoleId },
      });
      managerIds.push(user.id);
    }

    await prisma.accommodationManager.deleteMany({
      where: { accommodationId, year: YEAR, userId: null },
    });

    if (!managerIds.length) {
      const existingYear = await prisma.accommodationManager.findFirst({
        where: { accommodationId, year: YEAR },
        select: { id: true },
      });
      if (!existingYear) {
        await prisma.accommodationManager.create({
          data: {
            accommodationId,
            userId: null,
            year: YEAR,
            isPrimary: false,
            maleCapacity: venue.maleCapacity,
            femaleCapacity: venue.femaleCapacity,
          },
        });
      } else {
        await prisma.accommodationManager.updateMany({
          where: { accommodationId, year: YEAR },
          data: {
            maleCapacity: venue.maleCapacity,
            femaleCapacity: venue.femaleCapacity,
          },
        });
      }
      stats.withoutManager += 1;
      continue;
    }

    for (const [index, userId] of managerIds.entries()) {
      const existingPrimary = await prisma.accommodationManager.findFirst({
        where: { userId, year: YEAR, isPrimary: true },
        select: { id: true },
      });
      await prisma.accommodationManager.upsert({
        where: {
          userId_accommodationId_year: {
            userId,
            accommodationId,
            year: YEAR,
          },
        },
        update: {
          maleCapacity: venue.maleCapacity,
          femaleCapacity: venue.femaleCapacity,
        },
        create: {
          accommodationId,
          userId,
          year: YEAR,
          isPrimary: index === 0 && !existingPrimary,
          maleCapacity: venue.maleCapacity,
          femaleCapacity: venue.femaleCapacity,
        },
      });
      stats.managersLinked += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        sheet: sheet.name,
        venues: venues.length,
        year: YEAR,
        ...stats,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
