import {
  PlacementGenderPolicy,
  PlacementMode,
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';
import type { ReservationFeatures } from './reception-features';
import { defaultIranianFeatures } from './reception-features';

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
  features: ReservationFeatures = defaultIranianFeatures,
): ReservationStatus {
  if (!autoApprove) {
    return ReservationStatus.PENDING_MANAGEMENT_REVIEW;
  }
  return nextAfterManagement(type, features);
}

export function nextAfterManagement(
  type: ReservationType,
  features: ReservationFeatures = defaultIranianFeatures,
): ReservationStatus {
  if (type === ReservationType.INDIVIDUAL) {
    return features.insurance
      ? ReservationStatus.INSURANCE
      : ReservationStatus.COMPLETED;
  }
  if (features.companions) return ReservationStatus.COMPANIONS;
  if (type === ReservationType.CARAVAN) {
    return ReservationStatus.CARAVAN_CONTACTS;
  }
  return features.insurance
    ? ReservationStatus.INSURANCE
    : ReservationStatus.COMPLETED;
}

export function nextAfterCompanions(
  type: ReservationType,
  features: ReservationFeatures = defaultIranianFeatures,
): ReservationStatus {
  if (type === ReservationType.CARAVAN) {
    return ReservationStatus.CARAVAN_CONTACTS;
  }
  if (type === ReservationType.GROUP) {
    return features.insurance
      ? ReservationStatus.INSURANCE
      : ReservationStatus.COMPLETED;
  }
  throw new Error('مرحله همراهان برای این نوع پذیرش وجود ندارد');
}

export function nextAfterContacts(
  features: ReservationFeatures = defaultIranianFeatures,
): ReservationStatus {
  return features.insurance
    ? ReservationStatus.INSURANCE
    : ReservationStatus.COMPLETED;
}

/** Owner can keep editing companions after the step is completed, until the file is finished. */
export function companionEditStatuses(type: ReservationType): ReservationStatus[] {
  if (type === ReservationType.GROUP) {
    return [ReservationStatus.COMPANIONS, ReservationStatus.INSURANCE];
  }
  if (type === ReservationType.CARAVAN) {
    return [
      ReservationStatus.COMPANIONS,
      ReservationStatus.CARAVAN_CONTACTS,
      ReservationStatus.INSURANCE,
    ];
  }
  return [];
}

/** Owner can keep editing caravan contacts after the step is completed, until the file is finished. */
export function contactEditStatuses(type: ReservationType): ReservationStatus[] {
  if (type !== ReservationType.CARAVAN) return [];
  return [ReservationStatus.CARAVAN_CONTACTS, ReservationStatus.INSURANCE];
}

/** After management approval, capacity can be corrected without changing stage. */
export function canAdjustApprovedCapacity(
  type: ReservationType,
  status: ReservationStatus,
) {
  if (type === ReservationType.INDIVIDUAL) return false;
  return (
    status === ReservationStatus.COMPANIONS ||
    status === ReservationStatus.CARAVAN_CONTACTS ||
    status === ReservationStatus.INSURANCE
  );
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

const REWIND_STATUS_ORDER: ReservationStatus[] = [
  ReservationStatus.DRAFT,
  ReservationStatus.PENDING_MANAGEMENT_REVIEW,
  ReservationStatus.COMPANIONS,
  ReservationStatus.CARAVAN_CONTACTS,
  ReservationStatus.INSURANCE,
  ReservationStatus.COMPLETED,
];

function statusRank(status: ReservationStatus) {
  return REWIND_STATUS_ORDER.indexOf(status);
}

/** Stages management can rewind a file to, from its current status. */
export function validRewindStatuses(
  type: ReservationType,
  status: ReservationStatus,
): ReservationStatus[] {
  if (status === ReservationStatus.CANCELLED) return [];
  const allowed = validReturnStatuses(type);
  if (status === ReservationStatus.REJECTED) return allowed;
  const currentRank = statusRank(status);
  if (currentRank < 0) return [];
  return allowed.filter((item) => statusRank(item) < currentRank);
}

export function isOccupyingStatus(status: ReservationStatus) {
  return !NON_OCCUPYING_STATUSES.includes(status);
}

/** Owner create-wizard draft (never submitted / not admin-returned). */
export function isOwnerCreateDraft(reservation: {
  status: ReservationStatus;
  returnedToStatus?: ReservationStatus | null;
}) {
  return (
    reservation.status === ReservationStatus.DRAFT &&
    !reservation.returnedToStatus
  );
}

/** Approved headcount is unset until management reviews the file. */
export function unapprovedCounts() {
  return { maleCount: 0, femaleCount: 0, totalCount: 0 };
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

export function settingsPlacementModeKey(type: ReservationType) {
  if (type === ReservationType.INDIVIDUAL) return 'individualPlacementMode' as const;
  if (type === ReservationType.GROUP) return 'groupPlacementMode' as const;
  return 'caravanPlacementMode' as const;
}

export function placementModeFromSettings(
  settings: {
    individualPlacementMode: PlacementMode;
    groupPlacementMode: PlacementMode;
    caravanPlacementMode: PlacementMode;
  },
  type: ReservationType,
) {
  return settings[settingsPlacementModeKey(type)];
}

/** Male and female may share a place only when policy is MIXED and the place has both capacities. */
export function canAssignBothGendersTogether(
  policy: PlacementGenderPolicy,
  place: { maleCapacity: number; femaleCapacity: number },
) {
  return (
    policy === PlacementGenderPolicy.MIXED &&
    place.maleCapacity > 0 &&
    place.femaleCapacity > 0
  );
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
