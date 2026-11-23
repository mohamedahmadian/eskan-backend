import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  contentTranslationLocales,
  type ContentTranslationLocale,
} from '../../common/content-locales';
import {
  announcementAudiences,
  type AnnouncementAudienceValue,
} from '../announcement-audiences';

export class HeadquartersAnnouncementTranslationDto {
  @IsIn([...contentTranslationLocales])
  locale: ContentTranslationLocale;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  body?: string | null;
}

export class CreateHeadquartersAnnouncementDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(2)
  body: string;

  @IsIn([...announcementAudiences])
  audience: AnnouncementAudienceValue;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeadquartersAnnouncementTranslationDto)
  translations?: HeadquartersAnnouncementTranslationDto[];
}
