import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { toLatinDigits } from '../../common/national-id';

export class ForgotPasswordDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? toLatinDigits(value.trim()).replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @MinLength(8)
  identifier: string;
}
