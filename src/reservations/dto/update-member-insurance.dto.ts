import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { ReservationMemberInsuranceStatus } from '../../generated/prisma/client';

export class UpdateMemberInsuranceDto {
  @IsEnum(ReservationMemberInsuranceStatus)
  status: ReservationMemberInsuranceStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  insurancePlanId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  note?: string | null;
}
