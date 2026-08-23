import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  ReceptionSettings,
  ReservationType,
} from '../generated/prisma/client';
import {
  NON_OCCUPYING_STATUSES,
  settingsCapacityKeys,
} from './reservation-workflow';

export const CAPACITY_WARNING_RATIO = 0.8;

type Db = {
  reservation: Prisma.TransactionClient['reservation'];
  $queryRaw: Prisma.TransactionClient['$queryRaw'];
};

export async function lockReceptionSettings(tx: Db, year: number) {
  const rows = await tx.$queryRaw<Array<{ year: number }>>`
    SELECT year FROM reception_settings WHERE year = ${year} FOR UPDATE
  `;
  if (!rows.length) {
    throw new BadRequestException('تنظیمات پذیرش این سال تعریف نشده است');
  }
}

export async function occupiedCounts(
  tx: Db,
  year: number,
  type: ReservationType,
  excludeId?: string,
) {
  const rows = await tx.reservation.groupBy({
    by: ['type'],
    where: {
      year,
      type,
      status: { notIn: NON_OCCUPYING_STATUSES },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    _sum: { maleCount: true, femaleCount: true },
  });
  const sum = rows[0]?._sum;
  return {
    male: sum?.maleCount ?? 0,
    female: sum?.femaleCount ?? 0,
  };
}

export async function assertCapacity(
  tx: Db,
  settings: ReceptionSettings,
  type: ReservationType,
  year: number,
  addMale: number,
  addFemale: number,
  excludeId?: string,
) {
  await lockReceptionSettings(tx, year);
  const used = await occupiedCounts(tx, year, type, excludeId);
  const keys = settingsCapacityKeys(type);
  const maleCap = settings[keys.male];
  const femaleCap = settings[keys.female];

  if (used.male + addMale > maleCap) {
    throw new BadRequestException('ظرفیت مردان تکمیل شده است');
  }
  if (used.female + addFemale > femaleCap) {
    throw new BadRequestException('ظرفیت زنان تکمیل شده است');
  }
}

export function remainingCapacity(
  settings: ReceptionSettings,
  type: ReservationType,
  used: { male: number; female: number },
) {
  const keys = settingsCapacityKeys(type);
  return {
    maleCapacity: settings[keys.male],
    femaleCapacity: settings[keys.female],
    maleUsed: used.male,
    femaleUsed: used.female,
    maleRemaining: Math.max(0, settings[keys.male] - used.male),
    femaleRemaining: Math.max(0, settings[keys.female] - used.female),
  };
}
