import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class AssignAccommodationManagerDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  userId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;

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
}
