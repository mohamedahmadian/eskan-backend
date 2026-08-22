import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
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

export const iceVoucherSortFields = [
  'code',
  'accommodation',
  'manager',
  'moldCount',
  'totalCost',
  'requestedAt',
  'status',
  'paymentStatus',
] as const;

export type IceVoucherSortField = (typeof iceVoucherSortFields)[number];

export class FindIceVouchersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  accommodationId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  accommodationManagerId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(['UNPAID', 'PAID'])
  paymentStatus?: 'UNPAID' | 'PAID';

  @IsOptional()
  @Transform(({ value }) => toOptionalYear(value))
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...iceVoucherSortFields])
  sortBy?: IceVoucherSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
