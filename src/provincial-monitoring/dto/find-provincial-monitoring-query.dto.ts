import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindProvincialMonitoringQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;
}
