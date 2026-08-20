import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AssignAccommodationDto {
  @IsUUID()
  accommodationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;
}
