import { Transform } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class RejectReservationDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  reason?: string | null;
}
