import {
  PlacementGenderPolicy,
  PlacementMode,
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';
import {
  canAdjustApprovedCapacity,
  canAssignBothGendersTogether,
  isOwnerCreateDraft,
  nextAfterContacts,
  nextAfterManagement,
  placementModeFromSettings,
  validRewindStatuses,
  unapprovedCounts,
} from './reservation-workflow';
import { defaultIranianFeatures } from './reception-features';

describe('validRewindStatuses', () => {
  it('keeps all return targets for a rejected caravan', () => {
    expect(validRewindStatuses(ReservationType.CARAVAN, ReservationStatus.REJECTED)).toEqual([
      ReservationStatus.DRAFT,
      ReservationStatus.COMPANIONS,
      ReservationStatus.CARAVAN_CONTACTS,
      ReservationStatus.INSURANCE,
    ]);
  });

  it('lets a completed group return to companions without going through reject', () => {
    expect(validRewindStatuses(ReservationType.GROUP, ReservationStatus.COMPLETED)).toEqual([
      ReservationStatus.DRAFT,
      ReservationStatus.COMPANIONS,
      ReservationStatus.INSURANCE,
    ]);
  });

  it('only allows earlier stages from insurance', () => {
    expect(validRewindStatuses(ReservationType.CARAVAN, ReservationStatus.INSURANCE)).toEqual([
      ReservationStatus.DRAFT,
      ReservationStatus.COMPANIONS,
      ReservationStatus.CARAVAN_CONTACTS,
    ]);
  });

  it('has no rewind target from draft or cancelled', () => {
    expect(validRewindStatuses(ReservationType.GROUP, ReservationStatus.DRAFT)).toEqual([]);
    expect(validRewindStatuses(ReservationType.GROUP, ReservationStatus.CANCELLED)).toEqual([]);
  });
});

describe('isOwnerCreateDraft', () => {
  it('allows a never-submitted draft in basic info', () => {
    expect(
      isOwnerCreateDraft({ status: ReservationStatus.DRAFT, returnedToStatus: null }),
    ).toBe(true);
  });

  it('blocks files returned to draft and later workflow stages', () => {
    expect(
      isOwnerCreateDraft({
        status: ReservationStatus.DRAFT,
        returnedToStatus: ReservationStatus.INSURANCE,
      }),
    ).toBe(false);
    expect(
      isOwnerCreateDraft({
        status: ReservationStatus.PENDING_MANAGEMENT_REVIEW,
        returnedToStatus: null,
      }),
    ).toBe(false);
    expect(
      isOwnerCreateDraft({ status: ReservationStatus.INSURANCE, returnedToStatus: null }),
    ).toBe(false);
  });
});

describe('nextAfterManagement', () => {
  const noCompanionsInsurance = {
    ...defaultIranianFeatures,
    companions: false,
    insurance: false,
  };

  it('skips companions and insurance when those features are off', () => {
    expect(nextAfterManagement(ReservationType.GROUP, noCompanionsInsurance)).toBe(
      ReservationStatus.COMPLETED,
    );
    expect(nextAfterManagement(ReservationType.INDIVIDUAL, noCompanionsInsurance)).toBe(
      ReservationStatus.COMPLETED,
    );
  });

  it('still sends a caravan to contacts when companions are off', () => {
    expect(nextAfterManagement(ReservationType.CARAVAN, noCompanionsInsurance)).toBe(
      ReservationStatus.CARAVAN_CONTACTS,
    );
    expect(nextAfterContacts(noCompanionsInsurance)).toBe(ReservationStatus.COMPLETED);
  });
});

describe('unapprovedCounts', () => {
  it('keeps approved headcount at zero until management review', () => {
    expect(unapprovedCounts()).toEqual({
      maleCount: 0,
      femaleCount: 0,
      totalCount: 0,
    });
  });
});

describe('canAdjustApprovedCapacity', () => {
  it('allows group and caravan files after management approval', () => {
    expect(
      canAdjustApprovedCapacity(ReservationType.CARAVAN, ReservationStatus.COMPANIONS),
    ).toBe(true);
    expect(
      canAdjustApprovedCapacity(ReservationType.GROUP, ReservationStatus.INSURANCE),
    ).toBe(true);
  });

  it('blocks individual files and unapproved or finished stages', () => {
    expect(
      canAdjustApprovedCapacity(ReservationType.INDIVIDUAL, ReservationStatus.INSURANCE),
    ).toBe(false);
    expect(
      canAdjustApprovedCapacity(ReservationType.CARAVAN, ReservationStatus.DRAFT),
    ).toBe(false);
    expect(
      canAdjustApprovedCapacity(ReservationType.GROUP, ReservationStatus.COMPLETED),
    ).toBe(false);
  });
});

describe('placementModeFromSettings', () => {
  const settings = {
    individualPlacementMode: PlacementMode.SYSTEM,
    groupPlacementMode: PlacementMode.MANUAL,
    caravanPlacementMode: PlacementMode.SYSTEM,
  };

  it('reads the mode for the reservation type', () => {
    expect(placementModeFromSettings(settings, ReservationType.INDIVIDUAL)).toBe(
      PlacementMode.SYSTEM,
    );
    expect(placementModeFromSettings(settings, ReservationType.GROUP)).toBe(
      PlacementMode.MANUAL,
    );
    expect(placementModeFromSettings(settings, ReservationType.CARAVAN)).toBe(
      PlacementMode.SYSTEM,
    );
  });
});

describe('canAssignBothGendersTogether', () => {
  const both = { maleCapacity: 10, femaleCapacity: 8 };

  it('forbids mixing when policy is single-gender', () => {
    expect(
      canAssignBothGendersTogether(PlacementGenderPolicy.SINGLE_GENDER, both),
    ).toBe(false);
  });

  it('allows mixing only when policy is mixed and both capacities are set', () => {
    expect(canAssignBothGendersTogether(PlacementGenderPolicy.MIXED, both)).toBe(
      true,
    );
    expect(
      canAssignBothGendersTogether(PlacementGenderPolicy.MIXED, {
        maleCapacity: 10,
        femaleCapacity: 0,
      }),
    ).toBe(false);
    expect(
      canAssignBothGendersTogether(PlacementGenderPolicy.MIXED, {
        maleCapacity: 0,
        femaleCapacity: 8,
      }),
    ).toBe(false);
  });
});
