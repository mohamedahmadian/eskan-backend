import { AccommodationStatus } from '../generated/prisma/client';

/** Not yet approved, or deliberately taken out of assignment. */
export const ACCOMMODATION_UNAVAILABLE_STATUSES: AccommodationStatus[] = [
  AccommodationStatus.INACTIVE,
  AccommodationStatus.PENDING_REVIEW,
];

export function isAccommodationUnavailable(
  status: AccommodationStatus | string,
): boolean {
  return (
    status === AccommodationStatus.INACTIVE ||
    status === AccommodationStatus.PENDING_REVIEW
  );
}
