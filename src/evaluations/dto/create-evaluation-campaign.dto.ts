import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { EVALUATION_CAMPAIGN_STATUSES } from '../evaluation.constants';

export class CreateEvaluationCampaignDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsIn([...EVALUATION_CAMPAIGN_STATUSES])
  status?: (typeof EVALUATION_CAMPAIGN_STATUSES)[number];
}

export class UpdateEvaluationCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsIn([...EVALUATION_CAMPAIGN_STATUSES])
  status?: (typeof EVALUATION_CAMPAIGN_STATUSES)[number];
}

export class FindEvaluationCampaignsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsIn([...EVALUATION_CAMPAIGN_STATUSES])
  status?: (typeof EVALUATION_CAMPAIGN_STATUSES)[number];

  @IsOptional()
  @IsIn(['title', 'startAt', 'endAt', 'status', 'createdAt'])
  sortBy?: 'title' | 'startAt' | 'endAt' | 'status' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
