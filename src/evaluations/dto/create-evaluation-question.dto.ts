import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { emptyToNull, emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  EVALUATION_EVALUATOR_TYPES,
  EVALUATION_TARGET_TYPES,
} from '../evaluation.constants';

export class CreateEvaluationQuestionDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  description?: string | null;

  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  evaluatorType: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEvaluationQuestionDto {
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
  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  evaluatorType?: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  @IsOptional()
  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType?: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export const evaluationQuestionSortFields = [
  'title',
  'evaluatorType',
  'targetType',
  'sortOrder',
  'isActive',
  'createdAt',
] as const;

export class FindEvaluationQuestionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...EVALUATION_EVALUATOR_TYPES])
  evaluatorType?: (typeof EVALUATION_EVALUATOR_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...EVALUATION_TARGET_TYPES])
  targetType?: (typeof EVALUATION_TARGET_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...evaluationQuestionSortFields])
  sortBy?: (typeof evaluationQuestionSortFields)[number];

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
