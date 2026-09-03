import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';

export class FindStationReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  stationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;
}
