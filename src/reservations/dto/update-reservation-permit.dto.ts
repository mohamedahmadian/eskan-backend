import { Transform } from 'class-transformer';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class UpdateReservationPermitDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  issuedLicenseId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  permitImageId?: string | null;
}
