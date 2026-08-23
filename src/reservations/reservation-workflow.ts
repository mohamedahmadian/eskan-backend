import {
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';

export const IN_PROGRESS_FILTER = 'IN_PROGRESS';

export const IN_PROGRESS_STATUSES: ReservationStatus[] = [
  ReservationStatus.DRAFT,
  ReservationStatus.COMPANIONS,
  ReservationStatus.CARAVAN_CONTACTS,
  ReservationStatus.INSURANCE,
];

export const NON_OCCUPYING_STATUSES: ReservationStatus[] = [
  ReservationStatus.DRAFT,
  ReservationStatus.PENDING_MANAGEMENT_REVIEW,
  ReservationStatus.REJECTED,
  ReservationStatus.CANCELLED,
];

export const CARAVAN_CONTACT_ROLES = [
  'DEPUTY',
  'CLERIC',
  'CULTURAL',
  'SECURITY',
  'RECEPTION',
] as const;

export function nextAfterBasicInfo(
  type: ReservationType,
  autoApprove: boolean,
): ReservationStatus {
  if (!autoApprove) {
    return ReservationStatus.PENDING_MANAGEMENT_REVIEW;
  }
  return nextAfterManagement(type);
}

export function nextAfterManagement(type: ReservationType): ReservationStatus {
  if (type === ReservationType.INDIVIDUAL) {
    return ReservationStatus.INSURANCE;
  }
  return ReservationStatus.COMPANIONS;
}

export function nextAfterCompanions(type: ReservationType): ReservationStatus {
  if (type === ReservationType.CARAVAN) {
    return ReservationStatus.CARAVAN_CONTACTS;
  }
  if (type === ReservationType.GROUP) {
    return ReservationStatus.INSURANCE;
  }
  throw new Error('مرحله همراهان برای این نوع پذیرش وجود ندارد');
}

export function validReturnStatuses(type: ReservationType): ReservationStatus[] {
  if (type === ReservationType.INDIVIDUAL) {
    return [ReservationStatus.DRAFT, ReservationStatus.INSURANCE];
  }
  if (type === ReservationType.GROUP) {
    return [
      ReservationStatus.DRAFT,
      ReservationStatus.COMPANIONS,
      ReservationStatus.INSURANCE,
    ];
  }
  return [
    ReservationStatus.DRAFT,
    ReservationStatus.COMPANIONS,
    ReservationStatus.CARAVAN_CONTACTS,
    ReservationStatus.INSURANCE,
  ];
}

export function isOccupyingStatus(status: ReservationStatus) {
  return !NON_OCCUPYING_STATUSES.includes(status);
}

export function settingsEnabledKey(type: ReservationType) {
  if (type === ReservationType.INDIVIDUAL) return 'individualEnabled' as const;
  if (type === ReservationType.GROUP) return 'groupEnabled' as const;
  return 'caravanEnabled' as const;
}

export function settingsAutoApproveKey(type: ReservationType) {
  if (type === ReservationType.INDIVIDUAL) return 'individualAutoApprove' as const;
  if (type === ReservationType.GROUP) return 'groupAutoApprove' as const;
  return 'caravanAutoApprove' as const;
}

export function settingsCapacityKeys(type: ReservationType) {
  if (type === ReservationType.INDIVIDUAL) {
    return {
      male: 'individualMaleCapacity' as const,
      female: 'individualFemaleCapacity' as const,
    };
  }
  if (type === ReservationType.GROUP) {
    return {
      male: 'groupMaleCapacity' as const,
      female: 'groupFemaleCapacity' as const,
    };
  }
  return {
    male: 'caravanMaleCapacity' as const,
    female: 'caravanFemaleCapacity' as const,
  };
}
