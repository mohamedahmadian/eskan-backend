import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, MaxLength, Min } from 'class-validator';

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
}
