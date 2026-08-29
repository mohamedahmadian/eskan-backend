import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const placeTypeSortFields = [
  'nameFa',
  'code',
  'sortOrder',
  'isActive',
  'placeCount',
] as const;

export type PlaceTypeSortField = (typeof placeTypeSortFields)[number];

export class FindPlaceTypesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...placeTypeSortFields])
  sortBy?: PlaceTypeSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
