import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const schoolDistrictSortFields = ['name', 'description', 'createdAt'] as const;

export type SchoolDistrictSortField = (typeof schoolDistrictSortFields)[number];

export class FindSchoolDistrictsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...schoolDistrictSortFields])
  sortBy?: SchoolDistrictSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
