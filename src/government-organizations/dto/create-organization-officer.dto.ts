import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { normalizeMobile } from '../../common/phone';

export class CreateOrganizationOfficerDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeMobile(value) : value,
  )
  @IsString()
  @MinLength(10)
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;
}
