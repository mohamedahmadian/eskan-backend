import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  PlacementMode,
  PlacementStatus,
  ReservationType,
} from '../../generated/prisma/client';

export const placementQueueSortFields = [
  'year',
  'type',
  'placementStatus',
  'placementMode',
  'stayStartDate',
  'stayEndDate',
  'totalCount',
  'maleCount',
  'femaleCount',
  'createdAt',
  'party',
  'caravanManager',
] as const;

export type PlacementQueueSortField = (typeof placementQueueSortFields)[number];

export class FindPlacementQueueQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(ReservationType)
  type?: ReservationType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(PlacementStatus)
  placementStatus?: PlacementStatus;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(PlacementMode)
  placementMode?: PlacementMode;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  caravanId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...placementQueueSortFields])
  sortBy?: PlacementQueueSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
