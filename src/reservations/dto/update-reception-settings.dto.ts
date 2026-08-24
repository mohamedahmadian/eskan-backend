import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

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

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  insuranceOrganization: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  insurancePremiumAmount: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  insuranceCoverage: string;

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
