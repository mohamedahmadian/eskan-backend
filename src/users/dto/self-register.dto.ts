import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { UserGender } from '../../generated/prisma/client';
import { emptyToNull } from '../../common/dto-transform';
import { IsIranianNationalId, normalizeNationalId } from '../../common/national-id';
import { normalizeMobile } from '../../common/phone';

export class SelfRegisterDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeNationalId(value) : value,
  )
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeMobile(value) : value,
  )
  @IsString()
  @MinLength(11)
  phone: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(UserGender)
  gender?: UserGender | null;
}
