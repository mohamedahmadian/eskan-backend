import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserGender } from '../../generated/prisma/client';
import { emptyToNull, emptyToUndefined } from '../../common/dto-transform';
import { normalizePassportNumber, toLatinDigits } from '../../common/national-id';
import { normalizeMobile } from '../../common/phone';
import { APP_LOCALES } from './create-user.dto';

export class SelfRegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value.trim()) : value,
  )
  @IsString()
  @MinLength(3)
  username: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value) : value,
  )
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...APP_LOCALES])
  locale?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value == null ? UserGender.MALE : value,
  )
  @IsEnum(UserGender)
  gender?: UserGender;

  @ValidateIf((dto: SelfRegisterDto) => !dto.email)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeMobile(value) : value,
  )
  @IsString()
  @MinLength(11)
  phone?: string;

  @ValidateIf((dto: SelfRegisterDto) => Boolean(dto.email))
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePassportNumber(value) : value,
  )
  @IsString()
  @MinLength(5)
  passportNumber?: string;

  @ValidateIf((dto: SelfRegisterDto) => Boolean(dto.passportNumber) || Boolean(dto.email))
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : emptyToNull(value),
  )
  @IsEmail()
  email?: string;
}
