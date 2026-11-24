import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { IsIranianNationalId, normalizeNationalId } from '../../common/national-id';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const issuedLicenseSortFields = [
  'issuedAt',
  'status',
  'manager',
  'caravan',
  'createdAt',
] as const;

export type IssuedLicenseSortField = (typeof issuedLicenseSortFields)[number];

export const issuedLicenseStatuses = ['ISSUED', 'APPROVED', 'REVOKED'] as const;
export type IssuedLicenseStatusValue = (typeof issuedLicenseStatuses)[number];

export class FindIssuedLicensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...issuedLicenseStatuses])
  status?: IssuedLicenseStatusValue;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  caravanId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  managerUserId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...issuedLicenseSortFields])
  sortBy?: IssuedLicenseSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}

export class LookupCaravanManagerQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim()
      ? normalizeNationalId(value)
      : undefined,
  )
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @IsIranianNationalId({ message: 'کد ملی معتبر نیست' })
  nationalId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MinLength(2)
  caravanName?: string;
}
