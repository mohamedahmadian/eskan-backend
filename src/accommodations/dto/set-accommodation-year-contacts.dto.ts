import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AccommodationContactInputDto } from './accommodation-contact-input.dto';

export const yearContactModes = ['manager', 'fromAccommodation', 'manual'] as const;
export type YearContactMode = (typeof yearContactModes)[number];

export class SetAccommodationYearContactsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsIn(yearContactModes)
  mode: YearContactMode;

  @ValidateIf((dto: SetAccommodationYearContactsDto) => dto.mode === 'manual')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccommodationContactInputDto)
  contacts?: AccommodationContactInputDto[];
}
