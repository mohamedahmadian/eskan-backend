import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { MealType } from '../../generated/prisma/client';

export const restaurantMealPlanSortFields = [
  'planDate',
  'restaurant',
  'food',
  'mealType',
  'servings',
] as const;

export type RestaurantMealPlanSortField =
  (typeof restaurantMealPlanSortFields)[number];

export class FindRestaurantMealPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  foodId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  planDate?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(MealType)
  mealType?: MealType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...restaurantMealPlanSortFields])
  sortBy?: RestaurantMealPlanSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
