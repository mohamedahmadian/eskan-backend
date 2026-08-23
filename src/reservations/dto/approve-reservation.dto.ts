import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class ApproveReservationDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(2)
  notes?: string | null;
}
