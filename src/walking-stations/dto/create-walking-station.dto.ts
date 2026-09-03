import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
import { emptyToNull, toBoolean, toOptionalNumber } from '../../common/dto-transform';

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
  address?: string | null;

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
  @IsUUID()
  managerUserId?: string | null;

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

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasLaundry?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasInternet?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasPrayerRoom?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasElevator?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  heatingSystem?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  coolingSystem?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  parkingCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  bathroomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  toiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  areaSqm?: number | null;
}
