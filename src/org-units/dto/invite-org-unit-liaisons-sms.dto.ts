import { IsIn, IsOptional } from 'class-validator';

export const inviteLiaisonKinds = [
  'accommodation',
  'caravan',
  'all',
] as const;

export type InviteLiaisonKind = (typeof inviteLiaisonKinds)[number];

export class InviteOrgUnitLiaisonsSmsDto {
  @IsOptional()
  @IsIn(inviteLiaisonKinds)
  kind?: InviteLiaisonKind;
}
