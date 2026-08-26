export const supportRequestTypes = [
  'GOODS',
  'PLACE',
  'TRANSPORT',
  'OTHER',
] as const;

export type SupportRequestTypeValue = (typeof supportRequestTypes)[number];

export const supportRequestStatuses = [
  'PENDING',
  'IN_PROGRESS',
  'FULFILLED',
  'REJECTED',
] as const;

export type SupportRequestStatusValue = (typeof supportRequestStatuses)[number];

export const supportRequestSortFields = [
  'requestedAt',
  'type',
  'subject',
  'quantity',
  'status',
  'organization',
  'handlingOrganization',
  'handledAt',
  'neededBy',
] as const;

export type SupportRequestSortField = (typeof supportRequestSortFields)[number];

export const supportRequestTypeLabels: Record<SupportRequestTypeValue, string> =
  {
    GOODS: 'کالا',
    PLACE: 'مکان',
    TRANSPORT: 'حمل‌ونقل',
    OTHER: 'سایر',
  };

export const supportRequestStatusLabels: Record<
  SupportRequestStatusValue,
  string
> = {
  PENDING: 'در انتظار بررسی',
  IN_PROGRESS: 'در حال رسیدگی',
  FULFILLED: 'انجام شده',
  REJECTED: 'رد شده',
};
