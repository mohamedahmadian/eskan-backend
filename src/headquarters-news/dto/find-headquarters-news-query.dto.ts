import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const headquartersNewsSortFields = [
  'title',
  'publishedAt',
  'isPublished',
  'createdAt',
] as const;

export type HeadquartersNewsSortField =
  (typeof headquartersNewsSortFields)[number];

export class FindHeadquartersNewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...headquartersNewsSortFields])
  sortBy?: HeadquartersNewsSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
