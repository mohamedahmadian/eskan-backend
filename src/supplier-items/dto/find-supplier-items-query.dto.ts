import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

function toOptionalYear(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const supplierItemSortFields = [
  'name',
  'unit',
  'quantity',
  'deliveryDate',
] as const;

export type SupplierItemSortField = (typeof supplierItemSortFields)[number];

export class FindSupplierItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalYear(value))
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  availableOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...supplierItemSortFields])
  sortBy?: SupplierItemSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
