import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CaravanHeadcountLimitQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;

  @IsUUID()
  caravanId: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
