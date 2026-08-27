import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdjustReservationCapacityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maleCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  femaleCount: number;
}
