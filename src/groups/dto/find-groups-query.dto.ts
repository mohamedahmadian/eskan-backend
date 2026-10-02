import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const groupSortFields = [
  'name',
  'city',
  'walkingRoute',
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

/** فهرست «گروه‌های من»؛ مدیر می‌تواند گروه‌های شخص دیگری را ببیند. */
export class FindMineGroupsQueryDto extends FindGroupsQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID('4')
  userId?: string;
}
