import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  ReservationStatus,
  ReservationType,
} from '../../generated/prisma/client';
import { IN_PROGRESS_FILTER } from '../reservation-workflow';

export const reservationStatusFilters = [
  ...Object.values(ReservationStatus),
  IN_PROGRESS_FILTER,
] as const;

export const reservationSortFields = [
  'year',
  'type',
  'status',
  'stayStartDate',
  'createdAt',
  'updatedAt',
  'totalCount',
  'originCity',
  'createdBy',
] as const;

export type ReservationSortField = (typeof reservationSortFields)[number];

export class FindReservationsQueryDto extends PaginationQueryDto {
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
  @IsIn([...reservationStatusFilters])
  status?: ReservationStatus | typeof IN_PROGRESS_FILTER;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...reservationSortFields])
  sortBy?: ReservationSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  walkingRouteId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  originCityId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  caravanManagerId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  createdTo?: string;
}
