import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const unitLiaisonSortFields = [
  'fullName',
  'phone',
  'nationalId',
  'role',
] as const;

export type UnitLiaisonSortField = (typeof unitLiaisonSortFields)[number];

export class FindUnitLiaisonsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...unitLiaisonSortFields])
  sortBy?: UnitLiaisonSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
