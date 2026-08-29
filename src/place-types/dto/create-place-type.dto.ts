import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreatePlaceTypeDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameFa: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEn: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
