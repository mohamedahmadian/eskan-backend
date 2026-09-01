import { HonoraryServiceWeekDay } from '../generated/prisma/client';

export const HONORARY_SERVANT_ROLE = 'HONORARY_SERVANT';

export const TRANSLATION_SERVICE_CODE = 'TRANSLATION';

export function isTranslationServiceType(type?: {
  code?: string | null;
  name?: string | null;
} | null) {
  if (!type) return false;
  if (type.code === TRANSLATION_SERVICE_CODE) return true;
  return Boolean(type.name && /مترجم/.test(type.name));
}

export const honoraryServiceWeekDays = [
  HonoraryServiceWeekDay.SATURDAY,
  HonoraryServiceWeekDay.SUNDAY,
  HonoraryServiceWeekDay.MONDAY,
  HonoraryServiceWeekDay.TUESDAY,
  HonoraryServiceWeekDay.WEDNESDAY,
  HonoraryServiceWeekDay.THURSDAY,
  HonoraryServiceWeekDay.FRIDAY,
] as const;

export const honoraryServiceTypeSortFields = ['name', 'description', 'createdAt'] as const;
export type HonoraryServiceTypeSortField =
  (typeof honoraryServiceTypeSortFields)[number];

export const honoraryServantSortFields = [
  'fullName',
  'startDate',
  'endDate',
  'startTime',
  'serviceType',
  'createdAt',
] as const;
export type HonoraryServantSortField = (typeof honoraryServantSortFields)[number];

export const OTHER_SERVICE_TYPE = 'other';

export const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
