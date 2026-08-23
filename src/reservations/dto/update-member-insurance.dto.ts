import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { ReservationMemberInsuranceStatus } from '../../generated/prisma/client';

export class UpdateMemberInsuranceDto {
  @IsEnum(ReservationMemberInsuranceStatus)
  status: ReservationMemberInsuranceStatus;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  note?: string | null;
}
