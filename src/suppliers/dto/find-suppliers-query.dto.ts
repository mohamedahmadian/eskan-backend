import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { SupplierType } from '../../generated/prisma/client';

export const supplierSortFields = [
  'name',
  'type',
  'contactPerson',
  'phone',
] as const;

export type SupplierSortField = (typeof supplierSortFields)[number];

export class FindSuppliersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(SupplierType)
  type?: SupplierType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...supplierSortFields])
  sortBy?: SupplierSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
