import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { toOptionalBoolean } from '../../common/dto-transform';

export class TransferAccommodationsYearDto {
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  sourceYear!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  targetYear?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  all?: boolean;

  @ValidateIf((dto: TransferAccommodationsYearDto) => !dto.all)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  accommodationIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  copyManagers?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  copyYearContacts?: boolean;
}
