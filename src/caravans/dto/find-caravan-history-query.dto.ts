import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const caravanHistorySortFields = [
  'year',
  'status',
  'stayStartDate',
  'createdAt',
  'originCity',
  'totalCount',
] as const;

export type CaravanHistorySortField = (typeof caravanHistorySortFields)[number];

export class FindCaravanHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...caravanHistorySortFields])
  sortBy?: CaravanHistorySortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
