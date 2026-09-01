import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { normalizePassportNumber } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';

export class RegisterIdentityCheckDto {
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
    return trimmed ? trimmed.toLowerCase() : undefined;
  })
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? normalizePassportNumber(trimmed) : undefined;
  })
  @IsString()
  @MinLength(5)
  passportNumber?: string;
}
