import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, toOptionalNumber } from '../../common/dto-transform';
import { CreateReservationDto } from './create-reservation.dto';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  caravanManagerNotes?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(20)
  simCardNumber?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(40)
  simCardOperator?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  simCardDeliveredAt?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  simCardInitialCharge?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(32)
  bankCardNumber?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(34)
  bankCardIban?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(80)
  bankCardBank?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  bankCardDeliveredAt?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  bankCardInitialBalance?: number | null;
}
