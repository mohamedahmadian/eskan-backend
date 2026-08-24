import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { ReservationType } from '../../generated/prisma/client';

export class CreateReservationDto {
  @IsEnum(ReservationType)
  type: ReservationType;

  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;

  /** When true, save as DRAFT without advancing workflow (partial create-wizard data). */
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  originCityId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  walkingRouteId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  stayStartDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  stayEndDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  walkingStartDate?: string | null;

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

  /** Suggested headcount (پیشنهادی); when omitted, maleCount/femaleCount are used. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  requestedMaleCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  requestedFemaleCount?: number;

  @IsOptional()
  @IsBoolean()
  requestsAccommodation?: boolean;

  @IsOptional()
  @IsBoolean()
  requestsBus?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  caravanId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  caravanManagerId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  issuedLicenseId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  permitImageId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  createWizardStep?: string | null;

  /** Admin-only: create the reservation owned by this user. */
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  createdById?: string | null;
}
