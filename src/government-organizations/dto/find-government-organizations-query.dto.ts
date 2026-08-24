import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const governmentOrganizationSortFields = [
  'name',
  'phone',
  'contactPerson',
  'mobile',
] as const;

export type GovernmentOrganizationSortField =
  (typeof governmentOrganizationSortFields)[number];

export class FindGovernmentOrganizationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...governmentOrganizationSortFields])
  sortBy?: GovernmentOrganizationSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
