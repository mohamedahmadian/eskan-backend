import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class AssignCaravanYearDto {
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  managerUserId?: string | null;
}
