import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AccommodationStatus,
  AccommodationType,
  GenderType,
  ManagementType,
} from '../../generated/prisma/client';
import {
  emptyToNull,
  toBoolean,
  toOptionalNumber,
} from '../../common/dto-transform';
import { AccommodationContactInputDto } from './accommodation-contact-input.dto';
import { yearContactModes } from './set-accommodation-year-contacts.dto';

export class CreateAccommodationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(AccommodationType)
  type: AccommodationType;

  @IsOptional()
  @IsEnum(AccommodationStatus)
  status?: AccommodationStatus;

  @IsEnum(GenderType)
  genderType: GenderType;

  @IsOptional()
  @IsEnum(ManagementType)
  managementType?: ManagementType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maleCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  femaleCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  overflowPercent?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  phone?: string | null;

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
  eitaa?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  bale?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  otherSocial?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  countryId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  provinceId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  cityId?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  distanceToShrineKm?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  distanceToMashhadKm?: number | null;

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
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managerUserIds?: string[];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  primaryManagerUserId?: string | null;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, false))
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccommodationContactInputDto)
  contacts?: AccommodationContactInputDto[];

  @IsOptional()
  @IsIn(yearContactModes)
  yearContactMode?: (typeof yearContactModes)[number];
}
