import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, toBoolean } from '../../common/dto-transform';
import { cryptoCurrencies } from '../participations.constants';

export class CreateCryptoWalletDto {
  @IsIn([...cryptoCurrencies])
  currency: (typeof cryptoCurrencies)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  network?: string | null;

  @IsString()
  @MinLength(8)
  address: string;

  @IsString()
  @MinLength(2)
  label: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, true))
  @IsBoolean()
  isActive?: boolean;
}
