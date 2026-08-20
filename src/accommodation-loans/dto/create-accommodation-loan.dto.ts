import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class CreateAccommodationLoanDto {
  @IsUUID()
  supplierItemId: string;

  @IsUUID()
  accommodationManagerId: string;

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
  plannedReturnDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  actualReturnDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) {
      return null;
    }
    return Number(value);
  })
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  returnedQuantity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
