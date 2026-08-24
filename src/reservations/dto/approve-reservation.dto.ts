import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class ApproveReservationDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(2)
  notes?: string | null;

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
}
