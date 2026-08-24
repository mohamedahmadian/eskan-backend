import {
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';
import { validRewindStatuses, unapprovedCounts } from './reservation-workflow';

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

describe('unapprovedCounts', () => {
  it('keeps approved headcount at zero until management review', () => {
    expect(unapprovedCounts()).toEqual({
      maleCount: 0,
      femaleCount: 0,
      totalCount: 0,
    });
  });
});
