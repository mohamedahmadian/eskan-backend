import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class CreateIceVoucherDto {
  @IsUUID()
  accommodationId: string;

  @IsDateString()
  requestedAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  moldCount: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
