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
import { IsIranianNationalId, normalizeNationalId } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';
import { CaravanContactRole } from '../../generated/prisma/client';

export class SetReservationContactDto {
  @IsEnum(CaravanContactRole)
  role: CaravanContactRole;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeNationalId(value) : value,
  )
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

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
