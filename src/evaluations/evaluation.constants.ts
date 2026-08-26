import {
  EvaluationAnswerType,
  EvaluationEvaluatorType,
  EvaluationTargetType,
} from '../generated/prisma/client';

export const EVALUATION_EVALUATOR_TYPES = [
  'UNIT_MANAGER',
  'CARAVAN_MANAGER',
  'ACCOMMODATION_MANAGER',
  'PILGRIM',
] as const satisfies readonly EvaluationEvaluatorType[];

export const EVALUATION_TARGET_TYPES = [
  'CARAVAN_MANAGER',
  'ACCOMMODATION_MANAGER',
  'HEADQUARTERS',
] as const satisfies readonly EvaluationTargetType[];

export const EVALUATION_CAMPAIGN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'CLOSED',
] as const;

export const EVALUATION_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;

export const HEADQUARTERS_TARGET_KEY = 'HEADQUARTERS';

/** ماتریس مجاز ارزیاب → ارزیابی‌شونده */
export const EVALUATION_PAIRS: Record<
  EvaluationEvaluatorType,
  EvaluationTargetType[]
> = {
  UNIT_MANAGER: ['CARAVAN_MANAGER', 'ACCOMMODATION_MANAGER'],
  ACCOMMODATION_MANAGER: ['CARAVAN_MANAGER', 'HEADQUARTERS'],
  CARAVAN_MANAGER: ['ACCOMMODATION_MANAGER', 'HEADQUARTERS'],
  PILGRIM: ['CARAVAN_MANAGER', 'ACCOMMODATION_MANAGER', 'HEADQUARTERS'],
};

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const EVALUATION_ANSWER_TYPES = [
  'FIVE_SCALE',
  'TEXT',
  'YES_NO',
] as const satisfies readonly EvaluationAnswerType[];

export type EvaluationAnswerFields = {
  score: number | null;
  yesNo: boolean | null;
  textValue: string | null;
  description: string | null;
};

export function normalizeEvaluationAnswer(
  answerType: EvaluationAnswerType,
  input: {
    score?: number | null;
    yesNo?: boolean | null;
    textValue?: string | null;
    description?: string | null;
  },
): { ok: true; data: EvaluationAnswerFields } | { ok: false } {
  switch (answerType) {
    case 'FIVE_SCALE': {
      const score = input.score;
      if (
        score == null ||
        !Number.isInteger(score) ||
        score < SCORE_MIN ||
        score > SCORE_MAX
      ) {
        return { ok: false };
      }
      return {
        ok: true,
        data: {
          score,
          yesNo: null,
          textValue: null,
          description: input.description?.trim() || null,
        },
      };
    }
    case 'YES_NO': {
      if (typeof input.yesNo !== 'boolean') {
        return { ok: false };
      }
      return {
        ok: true,
        data: {
          score: null,
          yesNo: input.yesNo,
          textValue: null,
          description: null,
        },
      };
    }
    case 'TEXT': {
      const textValue = input.textValue?.trim() || null;
      if (!textValue) {
        return { ok: false };
      }
      return {
        ok: true,
        data: {
          score: null,
          yesNo: null,
          textValue,
          description: null,
        },
      };
    }
  }
}

export function isPairAllowed(
  evaluatorType: EvaluationEvaluatorType,
  targetType: EvaluationTargetType,
) {
  return EVALUATION_PAIRS[evaluatorType]?.includes(targetType) ?? false;
}

export function resolveTargetKey(
  targetType: EvaluationTargetType,
  targetId?: string | null,
) {
  if (targetType === 'HEADQUARTERS') {
    return HEADQUARTERS_TARGET_KEY;
  }
  if (!targetId) {
    throw new Error('targetId required');
  }
  return targetId;
}
