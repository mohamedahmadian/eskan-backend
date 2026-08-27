import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { UserGender } from '../../generated/prisma/client';

export class AllocatePlacementItemDto {
  @IsUUID()
  accommodationId: string;

  @IsEnum(UserGender)
  gender: UserGender;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount: number;

  @IsOptional()
  @IsBoolean()
  genderOverride?: boolean;

  @IsOptional()
  @IsString()
  overrideNote?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AllocatePlacementDto {
  @IsUUID()
  reservationId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocatePlacementItemDto)
  items: AllocatePlacementItemDto[];
}
