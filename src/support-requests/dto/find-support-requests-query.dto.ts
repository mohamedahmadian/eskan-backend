import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  supportRequestSortFields,
  supportRequestStatuses,
  supportRequestTypes,
  type SupportRequestSortField,
} from '../support-request.constants';

export class FindSupportRequestsQueryDto extends PaginationQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...supportRequestSortFields])
  sortBy?: SupportRequestSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
