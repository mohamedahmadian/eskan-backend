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
import { AccommodationContactRole } from '../../generated/prisma/client';

export class AccommodationContactInputDto {
  @IsEnum(AccommodationContactRole)
  role: AccommodationContactRole;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeNationalId(value) : value,
  )
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  phone: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  birthDate?: string | null;
}
