import {
  compareQueueSize,
  effectiveCapacity,
  genderTypeAllows,
  isDueForVacate,
  isGenderOverride,
  occupancyKey,
  placementStatusFromCounts,
  remainingForStay,
} from './placement-capacity';
import { runSystemAllocation } from './placement-algorithm';

describe('effectiveCapacity', () => {
  it('adds the overflow percent with floor', () => {
    expect(effectiveCapacity(100, 10)).toBe(110);
    expect(effectiveCapacity(15, 10)).toBe(16);
    expect(effectiveCapacity(0, 10)).toBe(0);
  });
});

describe('remainingForStay', () => {
  it('uses the tightest night in the stay range', () => {
    const occupancy = new Map<string, number>([
      [occupancyKey('a', 'MALE', '2026-08-26'), 90],
      [occupancyKey('a', 'MALE', '2026-08-27'), 40],
    ]);
    expect(
      remainingForStay(occupancy, 'a', 'MALE', '2026-08-26', '2026-08-27', 100, 10),
    ).toBe(20);
  });

  it('lets a later stay reuse capacity after the previous stay ends', () => {
    const occupancy = new Map<string, number>([
      [occupancyKey('a', 'MALE', '2026-08-20'), 100],
      [occupancyKey('a', 'MALE', '2026-08-21'), 100],
    ]);
    expect(
      remainingForStay(occupancy, 'a', 'MALE', '2026-08-22', '2026-08-23', 100, 0),
    ).toBe(100);
  });
});

describe('gender rules', () => {
  it('treats mixed venues as open to both genders', () => {
    expect(genderTypeAllows('MIXED', 'MALE')).toBe(true);
    expect(genderTypeAllows('FEMALE', 'MALE')).toBe(false);
    expect(isGenderOverride('FEMALE', 'MALE')).toBe(true);
  });
});

describe('placementStatusFromCounts', () => {
  it('maps allocated headcount to placement status', () => {
    expect(
      placementStatusFromCounts({
        requestsAccommodation: false,
        maleCount: 10,
        femaleCount: 8,
        allocatedMale: 0,
        allocatedFemale: 0,
      }),
    ).toBe('NOT_REQUIRED');
    expect(
      placementStatusFromCounts({
        requestsAccommodation: true,
        maleCount: 10,
        femaleCount: 8,
        allocatedMale: 0,
        allocatedFemale: 0,
      }),
    ).toBe('PENDING');
    expect(
      placementStatusFromCounts({
        requestsAccommodation: true,
        maleCount: 10,
        femaleCount: 8,
        allocatedMale: 10,
        allocatedFemale: 4,
      }),
    ).toBe('PARTIAL');
    expect(
      placementStatusFromCounts({
        requestsAccommodation: true,
        maleCount: 10,
        femaleCount: 8,
        allocatedMale: 10,
        allocatedFemale: 8,
      }),
    ).toBe('PLACED');
  });
});

describe('compareQueueSize', () => {
  it('puts larger files first then stable id', () => {
    const items = [
      { id: 'b', totalCount: 10 },
      { id: 'a', totalCount: 40 },
      { id: 'c', totalCount: 40 },
    ];
    expect([...items].sort(compareQueueSize).map((item) => item.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });
});

describe('runSystemAllocation', () => {
  const maleVenue = {
    id: 'm1',
    status: 'ACTIVE' as const,
    genderType: 'MALE' as const,
    maleCapacity: 100,
    femaleCapacity: 0,
    overflowPercent: 10,
  };
  const femaleVenue = {
    id: 'f1',
    status: 'ACTIVE' as const,
    genderType: 'FEMALE' as const,
    maleCapacity: 0,
    femaleCapacity: 80,
    overflowPercent: 10,
  };

  it('places larger files first and keeps genders in matching venues', () => {
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [maleVenue, femaleVenue],
      occupants: [],
      reservations: [
        {
          id: 'small',
          maleCount: 10,
          femaleCount: 8,
          totalCount: 18,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
        },
        {
          id: 'large',
          maleCount: 40,
          femaleCount: 30,
          totalCount: 70,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
        },
      ],
    });
    expect(placements[0]).toMatchObject({
      reservationId: 'large',
      accommodationId: 'm1',
      gender: 'MALE',
      headcount: 40,
    });
    expect(
      placements.find(
        (item) => item.reservationId === 'large' && item.gender === 'FEMALE',
      ),
    ).toMatchObject({ accommodationId: 'f1', headcount: 30 });
  });

  it('does not put men in a female venue', () => {
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [femaleVenue],
      occupants: [],
      reservations: [
        {
          id: 'r1',
          maleCount: 10,
          femaleCount: 0,
          totalCount: 10,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
        },
      ],
    });
    expect(placements).toEqual([]);
  });

  it('uses overflow capacity when nominal is full', () => {
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [maleVenue],
      occupants: [
        {
          reservationId: 'other',
          accommodationId: 'm1',
          gender: 'MALE',
          headcount: 100,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
        },
      ],
      reservations: [
        {
          id: 'r1',
          maleCount: 10,
          femaleCount: 0,
          totalCount: 10,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
        },
      ],
    });
    expect(placements).toEqual([
      {
        reservationId: 'r1',
        accommodationId: 'm1',
        gender: 'MALE',
        headcount: 10,
      },
    ]);
  });

  it('skips MANUAL files even if they are in the input list', () => {
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [maleVenue],
      occupants: [],
      reservations: [
        {
          id: 'manual',
          maleCount: 10,
          femaleCount: 0,
          totalCount: 10,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
          placementMode: 'MANUAL',
        },
      ],
    });
    expect(placements).toEqual([]);
  });

  it('keeps a mixed file in two venues under SINGLE_GENDER', () => {
    const mixedA = {
      id: 'mix-a',
      status: 'ACTIVE' as const,
      genderType: 'MIXED' as const,
      maleCapacity: 50,
      femaleCapacity: 50,
      overflowPercent: 10,
    };
    const mixedB = {
      id: 'mix-b',
      status: 'ACTIVE' as const,
      genderType: 'MIXED' as const,
      maleCapacity: 50,
      femaleCapacity: 50,
      overflowPercent: 10,
    };
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [mixedA, mixedB],
      occupants: [],
      reservations: [
        {
          id: 'r1',
          maleCount: 20,
          femaleCount: 15,
          totalCount: 35,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'SINGLE_GENDER',
        },
      ],
    });
    const male = placements.find((item) => item.gender === 'MALE');
    const female = placements.find((item) => item.gender === 'FEMALE');
    expect(male?.accommodationId).toBe('mix-a');
    expect(female?.accommodationId).toBe('mix-b');
  });

  it('can put both genders in one mixed venue when policy is MIXED', () => {
    const mixed = {
      id: 'mix-1',
      status: 'ACTIVE' as const,
      genderType: 'MIXED' as const,
      maleCapacity: 80,
      femaleCapacity: 80,
      overflowPercent: 10,
    };
    const placements = runSystemAllocation({
      random: () => 0,
      accommodations: [mixed],
      occupants: [],
      reservations: [
        {
          id: 'r1',
          maleCount: 20,
          femaleCount: 15,
          totalCount: 35,
          stayStartDate: '2026-08-20',
          stayEndDate: '2026-08-22',
          allocatedMale: 0,
          allocatedFemale: 0,
          policy: 'MIXED',
        },
      ],
    });
    expect(placements).toEqual([
      {
        reservationId: 'r1',
        accommodationId: 'mix-1',
        gender: 'MALE',
        headcount: 20,
      },
      {
        reservationId: 'r1',
        accommodationId: 'mix-1',
        gender: 'FEMALE',
        headcount: 15,
      },
    ]);
  });
});

describe('isDueForVacate', () => {
  it('frees the bed on the calendar day after stayEndDate', () => {
    expect(isDueForVacate('2026-08-26', '2026-08-26')).toBe(false);
    expect(isDueForVacate('2026-08-26', '2026-08-27')).toBe(true);
  });
});
