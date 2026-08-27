import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { PlacementGenderPolicy, PlacementMode } from '../../generated/prisma/client';

export class ReceptionInsurancePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  id?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  coverageAmount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  premiumAmount: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description: string;
}

export class UpdateReceptionSettingsDto {
  @IsBoolean()
  individualEnabled: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  individualMaleCapacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  individualFemaleCapacity: number;

  @IsBoolean()
  individualAutoApprove: boolean;

  @IsEnum(PlacementMode)
  individualPlacementMode: PlacementMode;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  individualIntro: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  individualRules: string;

  @IsBoolean()
  groupEnabled: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  groupMaleCapacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  groupFemaleCapacity: number;

  @IsBoolean()
  groupAutoApprove: boolean;

  @IsEnum(PlacementMode)
  groupPlacementMode: PlacementMode;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  groupIntro: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  groupRules: string;

  @IsBoolean()
  caravanEnabled: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  caravanMaleCapacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  caravanFemaleCapacity: number;

  @IsBoolean()
  caravanAutoApprove: boolean;

  @IsBoolean()
  caravanAutoApproveLicenses: boolean;

  @IsEnum(PlacementMode)
  caravanPlacementMode: PlacementMode;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  caravanIntro: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  caravanRules: string;

  @IsEnum(PlacementGenderPolicy)
  placementGenderPolicy: PlacementGenderPolicy;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  insuranceOrganization: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceptionInsurancePlanDto)
  insurancePlans: ReceptionInsurancePlanDto[];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  imamRezaMartyrdomDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  prophetDemiseDate?: string | null;
}
