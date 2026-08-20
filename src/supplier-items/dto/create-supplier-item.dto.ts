import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class CreateSupplierItemDto {
  @IsUUID()
  supplierId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(1)
  unit: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsDateString()
  deliveryDate: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  returnDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
