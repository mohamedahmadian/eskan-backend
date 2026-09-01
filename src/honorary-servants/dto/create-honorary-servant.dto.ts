import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { HonoraryServiceWeekDay } from '../../generated/prisma/client';
import { TIME_HH_MM } from '../honorary-servants.constants';

function toHhMm(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export class CreateHonoraryServantDto {
  @IsUUID('4')
  userId: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID('4')
  serviceTypeId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  otherDescription?: string | null;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(HonoraryServiceWeekDay, { each: true })
  weekDays: HonoraryServiceWeekDay[];

  @Transform(({ value }) => toHhMm(value))
  @IsString()
  @Matches(TIME_HH_MM, { message: 'ساعت شروع معتبر نیست' })
  startTime: string;

  @Transform(({ value }) => toHhMm(value))
  @IsString()
  @Matches(TIME_HH_MM, { message: 'ساعت پایان معتبر نیست' })
  endTime: string;
}
