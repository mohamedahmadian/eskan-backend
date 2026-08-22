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

export const accommodationLoanSortFields = [
  'item',
  'manager',
  'supplier',
  'quantity',
  'returnedQuantity',
  'deliveryDate',
] as const;

export type AccommodationLoanSortField =
  (typeof accommodationLoanSortFields)[number];

export class FindAccommodationLoansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  accommodationManagerId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  supplierItemId?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalYear(value))
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(['open', 'returned'])
  status?: 'open' | 'returned';

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(['full', 'partial', 'none'])
  returnStatus?: 'full' | 'partial' | 'none';

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...accommodationLoanSortFields])
  sortBy?: AccommodationLoanSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
