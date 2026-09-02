import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  announcementAudiences,
  type AnnouncementAudienceValue,
} from '../announcement-audiences';

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
}
