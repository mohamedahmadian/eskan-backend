import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { emptyToNull, toOptionalNumber } from '../../common/dto-transform';

export class WalkingRouteStageDto {
  @IsUUID()
  cityId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageNumber: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  distanceToNextKm?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  @Min(0)
  distanceToPreviousKm?: number | null;

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

export class CreateWalkingRouteDto {
  @IsString()
  @MinLength(2)
  name: string;

  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  distanceToMashhadKm: number;

  @IsUUID()
  entryBorderCityId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  originCountryIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WalkingRouteStageDto)
  stages: WalkingRouteStageDto[];
}
