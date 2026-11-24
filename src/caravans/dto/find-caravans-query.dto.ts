import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { CaravanStatus } from '../../generated/prisma/client';

export const caravanSortFields = [
  'name',
  'status',
  'city',
  'manager',
] as const;

export type CaravanSortField = (typeof caravanSortFields)[number];

export class FindCaravansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID('4')
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1300)
  @Max(1600)
  foundedYear?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(CaravanStatus)
  status?: CaravanStatus;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...caravanSortFields])
  sortBy?: CaravanSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}

/** فهرست «کاروان‌های من»؛ مدیر می‌تواند کاروان‌های شخص دیگری را ببیند. */
export class FindMineCaravansQueryDto extends FindCaravansQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID('4')
  userId?: string;
}
