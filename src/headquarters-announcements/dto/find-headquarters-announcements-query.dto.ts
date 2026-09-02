import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined, toOptionalBoolean } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import { announcementAudiences } from '../announcement-audiences';

export const headquartersAnnouncementSortFields = [
  'title',
  'audience',
  'publishedAt',
  'isPublished',
  'createdAt',
] as const;

export type HeadquartersAnnouncementSortField =
  (typeof headquartersAnnouncementSortFields)[number];

export class FindHeadquartersAnnouncementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...announcementAudiences])
  audience?: (typeof announcementAudiences)[number];

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...headquartersAnnouncementSortFields])
  sortBy?: HeadquartersAnnouncementSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
