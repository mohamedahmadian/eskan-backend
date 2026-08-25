import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { emptyToNull, emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  EVALUATION_EVALUATOR_TYPES,
  EVALUATION_STATUSES,
  EVALUATION_TARGET_TYPES,
  SCORE_MAX,
  SCORE_MIN,
} from '../evaluation.constants';

export class StartEvaluationDto {
  @IsUUID()
  campaignId: string;

  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  evaluatorType: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  /** فقط ادمین می‌تواند ارزیاب دیگری بگذارد؛ در غیر این صورت همان کاربر جاری */
  @IsOptional()
  @IsUUID()
  evaluatorId?: string;

  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  targetId?: string | null;
}

export class EvaluationAnswerItemDto {
  @IsUUID()
  questionId: string;

  @Type(() => Number)
  @IsInt()
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  score: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;
}

export class SubmitEvaluationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationAnswerItemDto)
  answers: EvaluationAnswerItemDto[];

  /** اگر true باشد ارزیابی COMPLETED می‌شود */
  @IsOptional()
  @Type(() => Boolean)
  complete?: boolean;
}

export const evaluationSortFields = [
  'startedAt',
  'completedAt',
  'status',
  'createdAt',
] as const;

export class FindEvaluationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  evaluatorType?: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType?: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...EVALUATION_STATUSES])
  status?: (typeof EVALUATION_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  evaluatorId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...evaluationSortFields])
  sortBy?: (typeof evaluationSortFields)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}

export class FindEvaluationTargetsQueryDto {
  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  q?: string;
}

/** Lookup کاربران برای انتخاب ارزیاب یا ارزیابی‌شونده (بر اساس نقش) */
export class FindEvaluationPeopleQueryDto {
  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  roleCode: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  q?: string;
}
