import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const pilgrimHistorySortFields = [
  'year',
  'type',
  'status',
  'stayStartDate',
  'createdAt',
  'caravan',
] as const;

export type PilgrimHistorySortField = (typeof pilgrimHistorySortFields)[number];

export class FindPilgrimHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...pilgrimHistorySortFields])
  sortBy?: PilgrimHistorySortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
