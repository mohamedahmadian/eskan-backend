import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { UserGender } from '../../generated/prisma/client';
import { emptyToUndefined } from '../../common/dto-transform';
import { normalizePassportNumber, toLatinDigits } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';
import { APP_LOCALES } from './create-user.dto';

export class SelfRegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value.trim()) : value,
  )
  @IsString()
  @MinLength(3)
  @Matches(/^[A-Za-z][A-Za-z0-9._-]*$/, {
    message: 'نام کاربری باید با حروف انگلیسی باشد',
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
}
