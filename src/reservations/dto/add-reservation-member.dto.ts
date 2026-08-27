import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import {
  IsIranianNationalId,
  normalizeNationalId,
  normalizePassportNumber,
} from '../../common/national-id';
import { normalizePhone } from '../../common/phone';
import { UserGender } from '../../generated/prisma/client';

export class AddReservationMemberDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return null;
    return typeof value === 'string' ? normalizeNationalId(value) : value;
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return null;
    return typeof value === 'string' ? normalizePassportNumber(value) : value;
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @MinLength(5, { message: 'شماره گذرنامه معتبر نیست' })
  passportNumber?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return null;
    return typeof value === 'string' ? normalizePhone(value) : value;
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  birthDate?: string | null;
}
