import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const placementDueSortFields = [
  'stayEndDate',
  'gender',
  'headcount',
  'placedAt',
  'party',
] as const;

export type PlacementDueSortField = (typeof placementDueSortFields)[number];

export class FindPlacementDueQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...placementDueSortFields])
  sortBy?: PlacementDueSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
