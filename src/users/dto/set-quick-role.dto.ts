import { IsBoolean } from 'class-validator';

export class SetQuickRoleDto {
  @IsBoolean()
  enabled: boolean;
}
