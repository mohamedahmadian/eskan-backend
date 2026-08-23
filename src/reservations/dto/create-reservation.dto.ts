import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
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

  @IsDateString()
  stayStartDate: string;

  @IsDateString()
  stayEndDate: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  walkingStartDate?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  maleCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  femaleCount: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  caravanId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  caravanManagerId?: string | null;
}
