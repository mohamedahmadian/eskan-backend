import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class ReservationPermitOptionsQueryDto {
  @IsUUID()
  caravanId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;
}
