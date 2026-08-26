import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import {
  supportRequestStatuses,
  supportRequestTypes,
} from '../support-request.constants';

function toOptionalYear(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class FindSupportRequestReportQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalYear(value))
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...supportRequestTypes])
  type?: (typeof supportRequestTypes)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...supportRequestStatuses])
  status?: (typeof supportRequestStatuses)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  handlingOrganizationId?: string;
}
