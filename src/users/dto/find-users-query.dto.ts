import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { UserGender } from '../../generated/prisma/client';

export const userSortFields = [
  'fullName',
  'username',
  'phone',
  'status',
  'nationalId',
  'city',
  'accommodationCount',
] as const;

export type UserSortField = (typeof userSortFields)[number];

/** Sentinel for pilgrims/users with no city assigned. */
export const CITY_ID_NONE = 'none';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const items = [
    ...new Set(raw.map((item) => String(item).trim()).filter(Boolean)),
  ];
  return items.length ? items : undefined;
}

export class FindUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  roleCode?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((_, value) => value !== CITY_ID_NONE)
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...userSortFields])
  sortBy?: UserSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
