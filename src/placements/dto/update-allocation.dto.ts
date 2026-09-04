import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { UserGender } from '../../generated/prisma/client';

export class UpdateAllocationDto {
  @IsOptional()
  @IsUUID()
  accommodationId?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  accommodatedCount?: number;

  @IsOptional()
  @IsBoolean()
  genderOverride?: boolean;

  @IsOptional()
  @IsString()
  overrideNote?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
