import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

function toOptionalYear(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const itemQuotaVoucherSortFields = [
  'code',
  'item',
  'manager',
  'quantity',
  'supplier',
  'issuedAt',
] as const;

export type ItemQuotaVoucherSortField =
  (typeof itemQuotaVoucherSortFields)[number];

export class FindItemQuotaVouchersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  quotaId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  accommodationManagerId?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalYear(value))
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...itemQuotaVoucherSortFields])
  sortBy?: ItemQuotaVoucherSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
