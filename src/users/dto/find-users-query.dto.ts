import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

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
  provinceId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  cityId?: string;
}
