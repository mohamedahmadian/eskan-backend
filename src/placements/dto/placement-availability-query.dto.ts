import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { emptyToUndefined } from '../../common/dto-transform';

export class PlacementAvailabilityQueryDto {
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  stayStartDate: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  stayEndDate: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  reservationId?: string;
}
