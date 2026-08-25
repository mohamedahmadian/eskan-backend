import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { caravanSortFields, type CaravanSortField } from './find-caravans-query.dto';

export const yearActivityFilters = ['all', 'active', 'inactive'] as const;
export type YearActivityFilter = (typeof yearActivityFilters)[number];

export class FindYearManagementQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year!: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...yearActivityFilters])
  yearActivity?: YearActivityFilter;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...caravanSortFields])
  sortBy?: CaravanSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
