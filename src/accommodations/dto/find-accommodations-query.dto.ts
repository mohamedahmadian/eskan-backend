import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { GenderType, ManagementType } from '../../generated/prisma/client';

export class FindAccommodationsQueryDto extends PaginationQueryDto {
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
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  hasManagerThisYear?: boolean;
}
