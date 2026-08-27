import { eachIsoDateInclusive } from '../common/iso-date';
import { PlacementGenderPolicy } from '../generated/prisma/client';
import { canAssignBothGendersTogether } from '../reservations/reservation-workflow';

export type PlacementGender = 'MALE' | 'FEMALE';
export type VenueGenderType = 'MALE' | 'FEMALE' | 'MIXED';
export type PlacementGenderPolicyValue = 'SINGLE_GENDER' | 'MIXED';

export function effectiveCapacity(capacity: number, overflowPercent: number) {
  const safeCapacity = Math.max(0, Math.floor(capacity));
  const safePercent = Math.max(0, Math.floor(overflowPercent));
  return safeCapacity + Math.floor((safeCapacity * safePercent) / 100);
}

export function occupancyKey(
  accommodationId: string,
  gender: PlacementGender,
  date: string,
) {
  return `${accommodationId}:${gender}:${date}`;
}

export type OccupancyMap = Map<string, number>;

export function occupancyCount(occupancy: OccupancyMap, key: string) {
  return occupancy.get(key) ?? 0;
}

export function addOccupancy(
  occupancy: OccupancyMap,
  accommodationId: string,
  gender: PlacementGender,
  dates: string[],
  headcount: number,
) {
  for (const date of dates) {
    const key = occupancyKey(accommodationId, gender, date);
    occupancy.set(key, occupancyCount(occupancy, key) + headcount);
  }
}

export function remainingOnDate(
  occupancy: OccupancyMap,
  accommodationId: string,
  gender: PlacementGender,
  date: string,
  capacity: number,
  overflowPercent: number,
) {
  const used = occupancyCount(
    occupancy,
    occupancyKey(accommodationId, gender, date),
  );
  return effectiveCapacity(capacity, overflowPercent) - used;
}

export function remainingForStay(
  occupancy: OccupancyMap,
  accommodationId: string,
  gender: PlacementGender,
  stayStartDate: string,
  stayEndDate: string,
  capacity: number,
  overflowPercent: number,
) {
  const dates = eachIsoDateInclusive(stayStartDate, stayEndDate);
  if (!dates.length) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const date of dates) {
    min = Math.min(
      min,
      remainingOnDate(
        occupancy,
        accommodationId,
        gender,
        date,
        capacity,
        overflowPercent,
      ),
    );
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min;
}

export function remainingNominalForStay(
  occupancy: OccupancyMap,
  accommodationId: string,
  gender: PlacementGender,
  stayStartDate: string,
  stayEndDate: string,
  capacity: number,
) {
  return remainingForStay(
    occupancy,
    accommodationId,
    gender,
    stayStartDate,
    stayEndDate,
    capacity,
    0,
  );
}

export function genderTypeAllows(
  genderType: VenueGenderType,
  gender: PlacementGender,
) {
  if (genderType === 'MIXED') return true;
  return genderType === gender;
}

export function isGenderOverride(
  genderType: VenueGenderType,
  gender: PlacementGender,
) {
  return !genderTypeAllows(genderType, gender);
}

export function venueCapacityFor(
  venue: { maleCapacity: number; femaleCapacity: number },
  gender: PlacementGender,
) {
  return gender === 'MALE' ? venue.maleCapacity : venue.femaleCapacity;
}

export function canShareVenueByPolicy(
  policy: PlacementGenderPolicyValue,
  venue: { maleCapacity: number; femaleCapacity: number },
) {
  return canAssignBothGendersTogether(
    policy === 'MIXED'
      ? PlacementGenderPolicy.MIXED
      : PlacementGenderPolicy.SINGLE_GENDER,
    venue,
  );
}

/** Capacity frees the calendar day after stayEndDate (stayEndDate < today). */
export function isDueForVacate(stayEndDate: string, today: string) {
  return stayEndDate < today;
}

export function placementStatusFromCounts(input: {
  requestsAccommodation: boolean;
  maleCount: number;
  femaleCount: number;
  allocatedMale: number;
  allocatedFemale: number;
}): 'NOT_REQUIRED' | 'PENDING' | 'PARTIAL' | 'PLACED' {
  if (!input.requestsAccommodation) return 'NOT_REQUIRED';
  const maleDone = input.allocatedMale === input.maleCount;
  const femaleDone = input.allocatedFemale === input.femaleCount;
  if (input.allocatedMale === 0 && input.allocatedFemale === 0) {
    return 'PENDING';
  }
  if (maleDone && femaleDone) return 'PLACED';
  return 'PARTIAL';
}

export function compareQueueSize(
  left: { totalCount: number; id: string },
  right: { totalCount: number; id: string },
) {
  if (right.totalCount !== left.totalCount) {
    return right.totalCount - left.totalCount;
  }
  return left.id.localeCompare(right.id);
}
