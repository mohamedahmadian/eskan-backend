export const ENTRY_BORDER_TYPES = ['LAND', 'AIR', 'SEA'] as const;

export type EntryBorderType = (typeof ENTRY_BORDER_TYPES)[number];
