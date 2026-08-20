import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { SupplierType } from '../../generated/prisma/client';

export class FindSuppliersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(SupplierType)
  type?: SupplierType;
}
