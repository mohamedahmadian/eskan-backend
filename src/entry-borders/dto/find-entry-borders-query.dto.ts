import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  emptyToUndefined,
  toOptionalBoolean,
} from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { ENTRY_BORDER_TYPES } from '../entry-border.constants';

export const entryBorderSortFields = [
  'name',
  'neighboringCountry',
  'province',
  'city',
  'borderType',
  'isActive',
] as const;

export type EntryBorderSortField = (typeof entryBorderSortFields)[number];

export class FindEntryBordersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  neighboringCountryId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...ENTRY_BORDER_TYPES])
  borderType?: (typeof ENTRY_BORDER_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...entryBorderSortFields])
  sortBy?: EntryBorderSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
