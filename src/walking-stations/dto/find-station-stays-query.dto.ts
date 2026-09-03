import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { emptyToUndefined, toBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { ReservationStationStayStatus } from '../../generated/prisma/client';

export const stationStaySortFields = [
  'stayDate',
  'reservedAt',
  'maleCount',
  'femaleCount',
  'present',
  'status',
] as const;

export type StationStaySortField = (typeof stationStaySortFields)[number];

export class FindStationStaysQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  stationId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  stayDate?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  from?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : toBoolean(value)))
  @IsBoolean()
  present?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(Object.values(ReservationStationStayStatus))
  status?: ReservationStationStayStatus;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...stationStaySortFields])
  sortBy?: StationStaySortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
