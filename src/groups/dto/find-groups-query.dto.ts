import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const groupSortFields = [
  'name',
  'city',
  'manager',
  'maleCount',
  'femaleCount',
  'totalCount',
] as const;

export type GroupSortField = (typeof groupSortFields)[number];

export class FindGroupsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...groupSortFields])
  sortBy?: GroupSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
