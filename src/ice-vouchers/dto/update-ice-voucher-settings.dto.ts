import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class UpdateIceVoucherSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  moldsPer50Pilgrims: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPerMold: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  activityStartDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  activityEndDate?: string | null;
}
