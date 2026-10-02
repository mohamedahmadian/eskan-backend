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

describe('isDueForVacate', () => {
  it('frees the bed on the calendar day after stayEndDate', () => {
    expect(isDueForVacate('2026-08-26', '2026-08-26')).toBe(false);
    expect(isDueForVacate('2026-08-26', '2026-08-27')).toBe(true);
  });
});
