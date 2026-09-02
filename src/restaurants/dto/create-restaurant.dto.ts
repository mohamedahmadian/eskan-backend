import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { normalizePhone } from '../../common/phone';

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  managerName?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? emptyToNull(normalizePhone(value))
      : emptyToNull(value),
  )
  @ValidateIf((_, value) => value != null)
  @IsString()
  managerPhone?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  neshanAddress?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
