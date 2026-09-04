import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { IsIranianNationalId, normalizeNationalId } from '../../common/national-id';
import { AccommodationContactRole } from '../../generated/prisma/client';

export class AccommodationContactInputDto {
  @IsEnum(AccommodationContactRole)
  role: AccommodationContactRole;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @ValidateIf((item: AccommodationContactInputDto) => !item.userId)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeNationalId(value) : value,
  )
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId?: string;

  @ValidateIf((item: AccommodationContactInputDto) => !item.userId)
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ValidateIf((item: AccommodationContactInputDto) => !item.userId)
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ValidateIf((item: AccommodationContactInputDto) => !item.userId)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  birthDate?: string | null;
}
