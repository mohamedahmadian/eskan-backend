import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { ingredientUnits } from '../../common/nutrition-units';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const ingredientSortFields = [
  'name',
  'unit',
  'pricePerUnit',
  'stockQty',
] as const;

export type IngredientSortField = (typeof ingredientSortFields)[number];

export class FindIngredientsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...ingredientUnits])
  unit?: (typeof ingredientUnits)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...ingredientSortFields])
  sortBy?: IngredientSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
