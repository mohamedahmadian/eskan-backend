import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  EvaluationEvaluatorType,
  EvaluationTargetType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEvaluationQuestionDto,
  FindEvaluationQuestionsQueryDto,
  UpdateEvaluationQuestionDto,
} from './dto/create-evaluation-question.dto';
import { isPairAllowed } from './evaluation.constants';

@Injectable()
export class EvaluationQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindEvaluationQuestionsQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = resolveSortOrder<Prisma.EvaluationQuestionOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        title: (dir) => ({ title: dir }),
        evaluatorType: (dir) => ({ evaluatorType: dir }),
        targetType: (dir) => ({ targetType: dir }),
        answerType: (dir) => ({ answerType: dir }),
        sortOrder: (dir) => ({ sortOrder: dir }),
        isActive: (dir) => ({ isActive: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    );
    const [items, total] = await Promise.all([
      this.prisma.evaluationQuestion.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.evaluationQuestion.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findForPair(
    evaluatorType: EvaluationEvaluatorType,
    targetType: EvaluationTargetType,
  ) {
    if (!isPairAllowed(evaluatorType, targetType)) {
      throw new BadRequestException('این ترکیب ارزیاب و ارزیابی‌شونده مجاز نیست');
    }
    return this.prisma.evaluationQuestion.findMany({
      where: {
        evaluatorType,
        targetType,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.evaluationQuestion.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('سوال ارزیابی یافت نشد');
    }
    return item;
  }

  async create(dto: CreateEvaluationQuestionDto) {
    if (!isPairAllowed(dto.evaluatorType, dto.targetType)) {
      throw new BadRequestException('این ترکیب ارزیاب و ارزیابی‌شونده مجاز نیست');
    }
    return this.prisma.evaluationQuestion.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        evaluatorType: dto.evaluatorType,
        targetType: dto.targetType,
        answerType: dto.answerType ?? 'FIVE_SCALE',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateEvaluationQuestionDto) {
    const current = await this.findOne(id);
    const evaluatorType = dto.evaluatorType ?? current.evaluatorType;
    const targetType = dto.targetType ?? current.targetType;
    if (!isPairAllowed(evaluatorType, targetType)) {
      throw new BadRequestException('این ترکیب ارزیاب و ارزیابی‌شونده مجاز نیست');
    }
    if (dto.answerType && dto.answerType !== current.answerType) {
      const answerCount = await this.prisma.evaluationAnswer.count({
        where: { questionId: id },
      });
      if (answerCount > 0) {
        throw new BadRequestException(
          'نوع پاسخ سوالی که قبلاً پاسخ دارد قابل تغییر نیست',
        );
      }
    }
    return this.prisma.evaluationQuestion.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        evaluatorType: dto.evaluatorType,
        targetType: dto.targetType,
        answerType: dto.answerType,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    const answerCount = await this.prisma.evaluationAnswer.count({
      where: { questionId: id },
    });
    if (answerCount > 0) {
      throw new BadRequestException(
        'سوالی که پاسخ دارد قابل حذف نیست؛ آن را غیرفعال کنید',
      );
    }
    await this.findOne(id);
    await this.prisma.evaluationQuestion.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindEvaluationQuestionsQueryDto,
  ): Prisma.EvaluationQuestionWhereInput {
    const filters: Prisma.EvaluationQuestionWhereInput[] = [];
    if (query.evaluatorType) {
      filters.push({ evaluatorType: query.evaluatorType });
    }
    if (query.targetType) {
      filters.push({ targetType: query.targetType });
    }
    if (query.answerType) {
      filters.push({ answerType: query.answerType });
    }
    if (query.isActive !== undefined) {
      filters.push({ isActive: query.isActive });
    }
    if (query.q) {
      filters.push({
        OR: [
          { title: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) return {};
    return filters.length === 1 ? filters[0] : { AND: filters };
  }
}
