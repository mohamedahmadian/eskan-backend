export const SYSTEM_ROLE_CODES = [
  'ADMIN',
  'PILGRIM',
  'CARAVAN_MANAGER',
  'GROUP_MANAGER',
  'ACCOMMODATION_MANAGER',
  'HEADQUARTERS_REPRESENTATIVE',
  'LICENSE_ISSUER',
  'UNIT_MANAGER',
  'GOVERNMENT_ORG_OFFICER',
  'HONORARY_SERVANT',
  'STATION_MANAGER',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const ROLE_ACCESS_MENU_CODE = 'users.roles';

const systemRoleSet = new Set<string>(SYSTEM_ROLE_CODES);

export function isSystemRoleCode(code: string) {
  return systemRoleSet.has(code);
}
