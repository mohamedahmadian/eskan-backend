import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { CreateReservationDto } from './create-reservation.dto';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  caravanManagerNotes?: string | null;
}
