import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, toOptionalNumber } from '../../common/dto-transform';
import { normalizePhone } from '../../common/phone';

export class CreateWalkingStationDto {
  @IsUUID()
  cityId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsLatitude()
  latitude?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsLongitude()
  longitude?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  neshanAddress?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maleCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  femaleCount?: number;

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
  managerTelegram?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? emptyToNull(normalizePhone(value))
      : emptyToNull(value),
  )
  @ValidateIf((_, value) => value != null)
  @IsString()
  managerWhatsapp?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  managerEitaa?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  distanceToMashhadKm?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
