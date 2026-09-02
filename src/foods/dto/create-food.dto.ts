import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ingredientUnits } from '../../common/nutrition-units';

export class FoodIngredientLineDto {
  @IsUUID()
  ingredientId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsIn([...ingredientUnits])
  unit: (typeof ingredientUnits)[number];
}

export class CreateFoodDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  finalPrice: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodIngredientLineDto)
  ingredients: FoodIngredientLineDto[];
}
