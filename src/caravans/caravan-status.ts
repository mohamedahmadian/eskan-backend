import { CaravanStatus } from '../generated/prisma/client';

export { CaravanStatus };

export const CARAVAN_STATUS_LABELS: Record<CaravanStatus, string> = {
  [CaravanStatus.ACTIVE]: 'فعال',
  [CaravanStatus.PENDING_REVIEW]: 'در انتظار بررسی',
  [CaravanStatus.INACTIVE]: 'غیرفعال',
};

export function isCaravanActive(status: CaravanStatus) {
  return status === CaravanStatus.ACTIVE;
}

export function caravanStatusLabel(status: CaravanStatus) {
  return CARAVAN_STATUS_LABELS[status];
}

export function withCaravanActiveFlag<T extends { status: CaravanStatus }>(
  row: T,
): T & { isActive: boolean } {
  return { ...row, isActive: isCaravanActive(row.status) };
}
