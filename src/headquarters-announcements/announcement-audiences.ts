export const announcementAudiences = [
  'PILGRIMS',
  'CARAVAN_MANAGERS',
  'ACCOMMODATION_MANAGERS',
] as const;

export type AnnouncementAudienceValue = (typeof announcementAudiences)[number];
