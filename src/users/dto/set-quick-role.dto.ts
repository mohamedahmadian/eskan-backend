import { IsBoolean } from 'class-validator';

export const quickAssignableRoleCodes = [
  'CARAVAN_MANAGER',
  'ACCOMMODATION_MANAGER',
  'HONORARY_SERVANT',
] as const;

export type QuickAssignableRoleCode = (typeof quickAssignableRoleCodes)[number];

export function isQuickAssignableRole(code: string): code is QuickAssignableRoleCode {
  return (quickAssignableRoleCodes as readonly string[]).includes(code);
}

export class SetQuickRoleDto {
  @IsBoolean()
  enabled: boolean;
}
