import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CalculateFromServingsDto {
  @IsUUID()
  foodId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  servings: number;
}

export class CalculateFromServingsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CalculateFromServingsDto)
  items: CalculateFromServingsDto[];
}
