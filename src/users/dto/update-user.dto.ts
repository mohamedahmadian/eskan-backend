import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { normalizeIdentityNumber } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['nationalId', 'phone', 'username', 'password', 'roleIds'] as const),
) {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : emptyToNull(value),
  )
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(3)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'نام کاربری باید انگلیسی باشد',
  })
  username?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeIdentityNumber(value) : emptyToNull(value),
  )
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(5)
  nationalId?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return null;
    return typeof value === 'string' ? normalizePhone(value) : value;
  })
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(8)
  phone?: string | null;
}
