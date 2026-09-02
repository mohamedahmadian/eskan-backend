import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export class CalculateFromStockDto {
  @IsUUID()
  ingredientId: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;
}
