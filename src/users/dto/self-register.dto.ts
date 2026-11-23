import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserGender } from '../../generated/prisma/client';
import { emptyToUndefined } from '../../common/dto-transform';
import { REGISTER_OTHER_COUNTRY } from '../../common/request-locale';
import { normalizePassportNumber, toLatinDigits } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';
import { APP_LOCALES } from './create-user.dto';

export class SelfRegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value.trim()) : value,
  )
  @IsString()
  @MinLength(3)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و . _ - باشد',
  })
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
  @ValidateIf((_, value) => Boolean(value) && value !== REGISTER_OTHER_COUNTRY)
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value == null ? UserGender.MALE : value,
  )
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? normalizePhone(trimmed) : undefined;
  })
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? normalizePassportNumber(trimmed) : undefined;
  })
  @IsString()
  @MinLength(5)
  passportNumber?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? trimmed.toLowerCase() : undefined;
  })
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(300)
  @Matches(/^https?:\/\/\S+$/i)
  loginUrl?: string;
}
