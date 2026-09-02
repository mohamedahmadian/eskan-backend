import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ingredientUnits } from '../../common/nutrition-units';

export class CreateIngredientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn([...ingredientUnits])
  unit: (typeof ingredientUnits)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
