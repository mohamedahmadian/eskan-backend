import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { supportRequestTypes } from '../support-request.constants';

export class CreateSupportRequestDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  organizationId?: string | null;

  @IsIn([...supportRequestTypes])
  type: (typeof supportRequestTypes)[number];

  @IsString()
  @MinLength(2)
  subject: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number | null;

  @IsDateString()
  requestedAt: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  neededBy?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
