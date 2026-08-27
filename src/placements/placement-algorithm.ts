import { eachIsoDateInclusive } from '../common/iso-date';
import {
  addOccupancy,
  canShareVenueByPolicy,
  compareQueueSize,
  genderTypeAllows,
  remainingForStay,
  venueCapacityFor,
  type OccupancyMap,
  type PlacementGender,
  type PlacementGenderPolicyValue,
  type VenueGenderType,
} from './placement-capacity';

export type AlgorithmReservation = {
  id: string;
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  stayStartDate: string;
  stayEndDate: string;
  allocatedMale: number;
  allocatedFemale: number;
  policy: PlacementGenderPolicyValue;
  placementMode?: 'SYSTEM' | 'MANUAL';
};

export type AlgorithmAccommodation = {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FULL';
  genderType: VenueGenderType;
  maleCapacity: number;
  femaleCapacity: number;
  overflowPercent: number;
};

export type AlgorithmOccupant = {
  reservationId: string;
  accommodationId: string;
  gender: PlacementGender;
  headcount: number;
  stayStartDate: string;
  stayEndDate: string;
};

export type AlgorithmPlacement = {
  reservationId: string;
  accommodationId: string;
  gender: PlacementGender;
  headcount: number;
};

function remainingOf(
  occupancy: OccupancyMap,
  venue: AlgorithmAccommodation,
  gender: PlacementGender,
  stayStartDate: string,
  stayEndDate: string,
  overflow: number,
) {
  return remainingForStay(
    occupancy,
    venue.id,
    gender,
    stayStartDate,
    stayEndDate,
    venueCapacityFor(venue, gender),
    overflow,
  );
}

function canUseVenue(input: {
  venue: AlgorithmAccommodation;
  gender: PlacementGender;
  policy: PlacementGenderPolicyValue;
  otherGenderHere: boolean;
}) {
  if (input.venue.status !== 'ACTIVE') return false;
  if (!genderTypeAllows(input.venue.genderType, input.gender)) return false;
  if (input.otherGenderHere && !canShareVenueByPolicy(input.policy, input.venue)) {
    return false;
  }
  return venueCapacityFor(input.venue, input.gender) > 0;
}

function pickRandom<T>(items: T[], random: () => number) {
  if (!items.length) return undefined;
  const index = Math.min(
    items.length - 1,
    Math.max(0, Math.floor(random() * items.length)),
  );
  return items[index];
}

function otherGenderAtVenue(
  occupants: Map<string, Set<PlacementGender>>,
  reservationId: string,
  accommodationId: string,
  gender: PlacementGender,
) {
  const key = `${reservationId}:${accommodationId}`;
  const genders = occupants.get(key);
  if (!genders) return false;
  return [...genders].some((item) => item !== gender);
}

function markOccupant(
  occupants: Map<string, Set<PlacementGender>>,
  reservationId: string,
  accommodationId: string,
  gender: PlacementGender,
) {
  const key = `${reservationId}:${accommodationId}`;
  const current = occupants.get(key) ?? new Set<PlacementGender>();
  current.add(gender);
  occupants.set(key, current);
}

function eligibleVenues(
  venues: AlgorithmAccommodation[],
  reservation: AlgorithmReservation,
  gender: PlacementGender,
  occupants: Map<string, Set<PlacementGender>>,
) {
  return venues.filter((venue) =>
    canUseVenue({
      venue,
      gender,
      policy: reservation.policy,
      otherGenderHere: otherGenderAtVenue(
        occupants,
        reservation.id,
        venue.id,
        gender,
      ),
    }),
  );
}

function allocateGender(input: {
  reservation: AlgorithmReservation;
  gender: PlacementGender;
  need: number;
  venues: AlgorithmAccommodation[];
  occupancy: OccupancyMap;
  occupants: Map<string, Set<PlacementGender>>;
  random: () => number;
}): AlgorithmPlacement[] {
  const { reservation, gender, venues, occupancy, occupants, random } = input;
  let need = input.need;
  if (need <= 0) return [];
  const dates = eachIsoDateInclusive(
    reservation.stayStartDate,
    reservation.stayEndDate,
  );
  if (!dates.length) return [];

  const placements: AlgorithmPlacement[] = [];

  const scored = (overflowFromVenue: boolean, minNeed: number) =>
    eligibleVenues(venues, reservation, gender, occupants)
      .map((venue) => ({
        venue,
        remaining: remainingOf(
          occupancy,
          venue,
          gender,
          reservation.stayStartDate,
          reservation.stayEndDate,
          overflowFromVenue ? venue.overflowPercent : 0,
        ),
      }))
      .filter((item) => item.remaining >= minNeed);

  const whole =
    scored(false, need).length > 0 ? scored(false, need) : scored(true, need);
  const wholePick = pickRandom(whole, random);
  if (wholePick) {
    addOccupancy(occupancy, wholePick.venue.id, gender, dates, need);
    markOccupant(occupants, reservation.id, wholePick.venue.id, gender);
    placements.push({
      reservationId: reservation.id,
      accommodationId: wholePick.venue.id,
      gender,
      headcount: need,
    });
    return placements;
  }

  while (need > 0) {
    const split = scored(true, 1);
    const pick = pickRandom(split, random);
    if (!pick) break;
    const take = Math.min(need, pick.remaining);
    addOccupancy(occupancy, pick.venue.id, gender, dates, take);
    markOccupant(occupants, reservation.id, pick.venue.id, gender);
    placements.push({
      reservationId: reservation.id,
      accommodationId: pick.venue.id,
      gender,
      headcount: take,
    });
    need -= take;
  }

  return placements;
}

export function runSystemAllocation(input: {
  reservations: AlgorithmReservation[];
  accommodations: AlgorithmAccommodation[];
  occupants: AlgorithmOccupant[];
  random?: () => number;
}): AlgorithmPlacement[] {
  const random = input.random ?? Math.random;
  const occupancy: OccupancyMap = new Map();
  const sharing = new Map<string, Set<PlacementGender>>();

  for (const row of input.occupants) {
    addOccupancy(
      occupancy,
      row.accommodationId,
      row.gender,
      eachIsoDateInclusive(row.stayStartDate, row.stayEndDate),
      row.headcount,
    );
    markOccupant(sharing, row.reservationId, row.accommodationId, row.gender);
  }

  const venues = input.accommodations.filter((item) => item.status === 'ACTIVE');
  const queue = [...input.reservations]
    .filter((item) => (item.placementMode ?? 'SYSTEM') === 'SYSTEM')
    .sort(compareQueueSize);
  const placements: AlgorithmPlacement[] = [];

  for (const reservation of queue) {
    const maleNeed = Math.max(0, reservation.maleCount - reservation.allocatedMale);
    const femaleNeed = Math.max(
      0,
      reservation.femaleCount - reservation.allocatedFemale,
    );
    placements.push(
      ...allocateGender({
        reservation,
        gender: 'MALE',
        need: maleNeed,
        venues,
        occupancy,
        occupants: sharing,
        random,
      }),
      ...allocateGender({
        reservation,
        gender: 'FEMALE',
        need: femaleNeed,
        venues,
        occupancy,
        occupants: sharing,
        random,
      }),
    );
  }

  return placements;
}
