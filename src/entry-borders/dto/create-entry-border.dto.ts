import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, toOptionalBoolean } from '../../common/dto-transform';
import { ENTRY_BORDER_TYPES } from '../entry-border.constants';

export class CreateEntryBorderDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsUUID()
  neighboringCountryId: string;

  @IsUUID()
  provinceId: string;

  @IsUUID()
  cityId: string;

  @IsIn([...ENTRY_BORDER_TYPES])
  borderType: (typeof ENTRY_BORDER_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}
