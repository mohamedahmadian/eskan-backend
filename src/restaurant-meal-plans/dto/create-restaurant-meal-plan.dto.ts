import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { MealType } from '../../generated/prisma/client';

export class CreateRestaurantMealPlanDto {
  @IsUUID()
  restaurantId: string;

  @IsUUID()
  foodId: string;

  @IsDateString()
  planDate: string;

  @IsEnum(MealType)
  mealType: MealType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  servings: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
