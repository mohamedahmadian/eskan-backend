import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';

export const participantSortFields = [
  'fullName',
  'phone',
  'shareCount',
  'paidAmount',
  'createdAt',
] as const;

export type ParticipantSortField = (typeof participantSortFields)[number];

export class FindCampaignParticipantsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...participantSortFields])
  sortBy?: ParticipantSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
