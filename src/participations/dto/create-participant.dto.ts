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

export class CreateCampaignParticipantDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  phone?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  shareCount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidAmount?: number;
}
