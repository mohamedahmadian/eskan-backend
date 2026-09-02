import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { AccommodationType, GenderType, ManagementType } from '../../generated/prisma/client';

export const accommodationSortFields = [
  'name',
  'type',
  'managementType',
  'genderType',
] as const;

export type AccommodationSortField = (typeof accommodationSortFields)[number];

export class FindAccommodationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(AccommodationType)
  type?: AccommodationType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(GenderType)
  genderType?: GenderType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(ManagementType)
  managementType?: ManagementType;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  })
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  managerUserId?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  hasManagerThisYear?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...accommodationSortFields])
  sortBy?: AccommodationSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
