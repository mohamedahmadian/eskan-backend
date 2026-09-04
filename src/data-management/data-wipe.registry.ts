export const DATA_WIPE_ENTITY_CODES = [
  'reservations',
  'contributions-cash',
  'contributions-in-kind',
] as const;

export type DataWipeEntityCode = (typeof DATA_WIPE_ENTITY_CODES)[number];

export function isDataWipeEntityCode(
  value: string,
): value is DataWipeEntityCode {
  return (DATA_WIPE_ENTITY_CODES as readonly string[]).includes(value);
}
