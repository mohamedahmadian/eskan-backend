import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, toBoolean } from '../../common/dto-transform';

export class CreateBankAccountDto {
  @IsString()
  @MinLength(2)
  bankName: string;

  @IsString()
  @MinLength(4)
  accountNumber: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  cardNumber?: string | null;

  @IsString()
  @MinLength(10)
  iban: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, true))
  @IsBoolean()
  isActive?: boolean;
}
