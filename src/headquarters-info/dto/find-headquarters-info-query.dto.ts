import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const headquartersInfoSortFields = [
  'name',
  'title',
  'address',
  'neshanAddress',
  'activityStartYear',
  'phoneCount',
] as const;

export type HeadquartersInfoSortField =
  (typeof headquartersInfoSortFields)[number];

export class FindHeadquartersInfoQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...headquartersInfoSortFields])
  sortBy?: HeadquartersInfoSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
