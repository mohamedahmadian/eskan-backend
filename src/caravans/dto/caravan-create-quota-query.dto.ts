import { IsOptional, IsUUID } from 'class-validator';

export class CaravanCreateQuotaQueryDto {
  @IsOptional()
  @IsUUID('4')
  managerUserId?: string;
}
