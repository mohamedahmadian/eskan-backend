import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const assignmentManagerFilters = ['all', 'with', 'without'] as const;
export type AssignmentManagerFilter = (typeof assignmentManagerFilters)[number];

export const assignmentSortFields = ['name', 'type', 'city'] as const;
export type AssignmentSortField = (typeof assignmentSortFields)[number];

export class FindAccommodationAssignmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...assignmentManagerFilters])
  managerStatus?: AssignmentManagerFilter;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...assignmentSortFields])
  sortBy?: AssignmentSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
