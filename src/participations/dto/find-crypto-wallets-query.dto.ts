import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { cryptoCurrencies } from '../participations.constants';

export const cryptoWalletSortFields = [
  'label',
  'currency',
  'network',
  'address',
  'isActive',
] as const;

export type CryptoWalletSortField = (typeof cryptoWalletSortFields)[number];

export class FindCryptoWalletsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...cryptoCurrencies])
  currency?: (typeof cryptoCurrencies)[number];

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...cryptoWalletSortFields])
  sortBy?: CryptoWalletSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
