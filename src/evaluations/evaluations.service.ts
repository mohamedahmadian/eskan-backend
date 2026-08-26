import {
  BadRequestException,
  ForbiddenException,
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
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FindEvaluationPeopleQueryDto,
  FindEvaluationTargetsQueryDto,
  FindEvaluationsQueryDto,
  StartEvaluationDto,
  SubmitEvaluationDto,
} from './dto/evaluation-actions.dto';
import {
  EVALUATION_EVALUATOR_TYPES,
  EVALUATION_PAIRS,
  computePerformanceRank,
  isPairAllowed,
  normalizeEvaluationAnswer,
  resolveTargetKey,
} from './evaluation.constants';
import { EvaluationQuestionsService } from './evaluation-questions.service';

type Actor = {
  id: string;
  roles?: { code: string }[];
  userRoles?: { role: { code: string } }[];
};

const personSelect = {
  id: true,
  fullName: true,
  nationalId: true,
  phone: true,
  username: true,
} satisfies Prisma.UserSelect;

const evaluationInclude = {
  campaign: true,
  evaluator: { select: personSelect },
  target: { select: personSelect },
  submittedBy: { select: personSelect },
  answers: {
    include: { question: true },
    orderBy: { question: { sortOrder: 'asc' as const } },
  },
} satisfies Prisma.EvaluationInclude;

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: EvaluationQuestionsService,
  ) {}

  private roleCodes(actor: Actor) {
    return new Set(
      actor.userRoles?.map((item) => item.role.code) ??
        actor.roles?.map((role) => role.code) ??
        [],
    );
  }

  private isAdmin(actor: Actor) {
    return this.roleCodes(actor).has('ADMIN');
  }

  private actorEvaluatorTypes(actor: Actor): EvaluationEvaluatorType[] {
    const codes = this.roleCodes(actor);
    return EVALUATION_EVALUATOR_TYPES.filter((type) => codes.has(type));
  }

  async findAll(query: FindEvaluationsQueryDto, actor: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('فقط مدیر سیستم به فهرست همه ارزیابی‌ها دسترسی دارد');
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = resolveSortOrder<Prisma.EvaluationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        startedAt: (dir) => ({ startedAt: dir }),
        completedAt: (dir) => ({ completedAt: dir }),
        status: (dir) => ({ status: dir }),
        performanceRank: (dir) => ({
          performanceRank: { sort: dir, nulls: 'last' },
        }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
    const [items, total] = await Promise.all([
      this.prisma.evaluation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          campaign: true,
          evaluator: { select: personSelect },
          target: { select: personSelect },
          submittedBy: { select: personSelect },
          _count: { select: { answers: true } },
        },
      }),
      this.prisma.evaluation.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findMine(actor: Actor) {
    const evaluatorTypes = this.actorEvaluatorTypes(actor);
    const [activeCampaigns, evaluations] = await Promise.all([
      this.prisma.evaluationCampaign.findMany({
        where: {
          status: 'ACTIVE',
          startAt: { lte: this.today() },
          endAt: { gte: this.today() },
        },
        orderBy: [{ startAt: 'desc' }],
      }),
      this.prisma.evaluation.findMany({
        where: { evaluatorId: actor.id },
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          campaign: true,
          target: { select: personSelect },
          submittedBy: { select: personSelect },
          _count: { select: { answers: true } },
        },
        take: 100,
      }),
    ]);
    return {
      evaluatorTypes,
      allowedPairs: evaluatorTypes.map((evaluatorType) => ({
        evaluatorType,
        targetTypes: EVALUATION_PAIRS[evaluatorType],
      })),
      activeCampaigns,
      evaluations,
    };
  }

  async findTargets(query: FindEvaluationTargetsQueryDto) {
    if (query.targetType === 'HEADQUARTERS') {
      return [];
    }
    return this.findPeopleByRole(query.targetType, query.q);
  }

  async findPeople(query: FindEvaluationPeopleQueryDto) {
    return this.findPeopleByRole(query.roleCode, query.q);
  }

  private async findPeopleByRole(roleCode: string, q?: string) {
    const where: Prisma.UserWhereInput = {
      status: UserStatus.ACTIVE,
      userRoles: { some: { role: { code: roleCode } } },
    };
    if (q) {
      where.AND = [
        {
          OR: [
            { fullName: containsInsensitive(q) },
            { nationalId: containsInsensitive(q) },
            { phone: containsInsensitive(q) },
            { username: containsInsensitive(q) },
          ],
        },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: personSelect,
      orderBy: [{ fullName: 'asc' }],
      take: 100,
    });
  }

  async findOne(id: string, actor: Actor) {
    const item = await this.prisma.evaluation.findUnique({
      where: { id },
      include: evaluationInclude,
    });
    if (!item) {
      throw new NotFoundException('ارزیابی یافت نشد');
    }
    if (!this.isAdmin(actor) && item.evaluatorId !== actor.id) {
      throw new ForbiddenException('دسترسی به این ارزیابی مجاز نیست');
    }
    return item;
  }

  async start(dto: StartEvaluationDto, actor: Actor) {
    if (!isPairAllowed(dto.evaluatorType, dto.targetType)) {
      throw new BadRequestException('این ترکیب ارزیاب و ارزیابی‌شونده مجاز نیست');
    }

    const admin = this.isAdmin(actor);
    const evaluatorId = admin && dto.evaluatorId ? dto.evaluatorId : actor.id;

    if (!admin) {
      if (dto.evaluatorId && dto.evaluatorId !== actor.id) {
        throw new ForbiddenException('نمی‌توانید به‌نیابت دیگران ارزیابی کنید');
      }
      const types = this.actorEvaluatorTypes(actor);
      if (!types.includes(dto.evaluatorType)) {
        throw new ForbiddenException('نقش ارزیاب با حساب شما هم‌خوان نیست');
      }
    }

    await this.assertUserHasRole(evaluatorId, dto.evaluatorType);

    let targetId: string | null = null;
    if (dto.targetType === 'HEADQUARTERS') {
      targetId = null;
    } else {
      if (!dto.targetId) {
        throw new BadRequestException('فرد ارزیابی‌شونده را انتخاب کنید');
      }
      await this.assertUserHasRole(dto.targetId, dto.targetType);
      targetId = dto.targetId;
    }

    const campaign = await this.prisma.evaluationCampaign.findUnique({
      where: { id: dto.campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('دوره ارزیابی یافت نشد');
    }
    this.assertCampaignOpen(campaign);

    const questions = await this.questions.findForPair(
      dto.evaluatorType,
      dto.targetType,
    );
    if (!questions.length) {
      throw new BadRequestException(
        'برای این ترکیب هنوز سوال فعالی تعریف نشده است',
      );
    }

    const targetKey = resolveTargetKey(dto.targetType, targetId);

    const existing = await this.prisma.evaluation.findUnique({
      where: {
        campaignId_evaluatorId_evaluatorType_targetType_targetKey: {
          campaignId: dto.campaignId,
          evaluatorId,
          evaluatorType: dto.evaluatorType,
          targetType: dto.targetType,
          targetKey,
        },
      },
      include: evaluationInclude,
    });
    if (existing) {
      return existing;
    }

    return this.prisma.evaluation.create({
      data: {
        campaignId: dto.campaignId,
        evaluatorId,
        evaluatorType: dto.evaluatorType,
        targetId,
        targetType: dto.targetType,
        targetKey,
        status: 'IN_PROGRESS',
        submittedById: actor.id,
        startedAt: new Date(),
      },
      include: evaluationInclude,
    });
  }

  async submit(id: string, dto: SubmitEvaluationDto, actor: Actor) {
    const evaluation = await this.findOne(id, actor);
    const campaign = evaluation.campaign;
    this.assertCampaignOpen(campaign);

    if (evaluation.status === 'COMPLETED' && !this.isAdmin(actor)) {
      throw new BadRequestException('این ارزیابی قبلاً تکمیل شده است');
    }

    const questions = await this.questions.findForPair(
      evaluation.evaluatorType,
      evaluation.targetType,
    );
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const normalized: {
      questionId: string;
      score: number | null;
      yesNo: boolean | null;
      textValue: string | null;
      description: string | null;
    }[] = [];

    for (const answer of dto.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('یکی از سوالات به این ارزیابی تعلق ندارد');
      }
      const parsed = normalizeEvaluationAnswer(question.answerType, answer);
      if (!parsed.ok) {
        throw new BadRequestException(
          `پاسخ سوال «${question.title}» با نوع پاسخ آن هم‌خوان نیست`,
        );
      }
      normalized.push({ questionId: answer.questionId, ...parsed.data });
    }

    const complete = dto.complete !== false;
    if (complete) {
      const answered = new Set(normalized.map((a) => a.questionId));
      const missing = questions.filter((q) => !answered.has(q.id));
      if (missing.length) {
        throw new BadRequestException('به همه سوالات پاسخ دهید');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const answer of normalized) {
        await tx.evaluationAnswer.upsert({
          where: {
            evaluationId_questionId: {
              evaluationId: id,
              questionId: answer.questionId,
            },
          },
          create: {
            evaluationId: id,
            questionId: answer.questionId,
            score: answer.score,
            yesNo: answer.yesNo,
            textValue: answer.textValue,
            description: answer.description,
          },
          update: {
            score: answer.score,
            yesNo: answer.yesNo,
            textValue: answer.textValue,
            description: answer.description,
          },
        });
      }

      const scaleAnswers = await tx.evaluationAnswer.findMany({
        where: { evaluationId: id, score: { not: null } },
        select: { score: true },
      });

      await tx.evaluation.update({
        where: { id },
        data: {
          submittedById: actor.id,
          submittedAt: new Date(),
          performanceRank: computePerformanceRank(scaleAnswers.map((item) => item.score)),
          ...(complete
            ? { status: 'COMPLETED', completedAt: new Date() }
            : { status: 'IN_PROGRESS', completedAt: null }),
        },
      });
    });

    return this.findOne(id, actor);
  }

  async remove(id: string, actor: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('حذف ارزیابی فقط برای مدیر سیستم مجاز است');
    }
    await this.findOne(id, actor);
    await this.prisma.evaluation.delete({ where: { id } });
    return { ok: true };
  }

  private today() {
    const day = new Date().toISOString().slice(0, 10);
    return new Date(`${day}T00:00:00.000Z`);
  }

  private assertCampaignOpen(campaign: {
    status: string;
    startAt: Date;
    endAt: Date;
    title: string;
  }) {
    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException('این دوره ارزیابی فعال نیست');
    }
    const today = this.today();
    if (campaign.startAt > today || campaign.endAt < today) {
      throw new BadRequestException('این دوره ارزیابی خارج از بازه زمانی است');
    }
  }

  private async assertUserHasRole(
    userId: string,
    roleCode: EvaluationEvaluatorType | EvaluationTargetType,
  ) {
    if (roleCode === 'HEADQUARTERS') {
      return;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('کاربر انتخاب‌شده معتبر نیست');
    }
    if (!user.userRoles.some((item) => item.role.code === roleCode)) {
      throw new BadRequestException('نقش کاربر با نوع انتخاب‌شده هم‌خوان نیست');
    }
  }

  private listWhere(
    query: FindEvaluationsQueryDto,
  ): Prisma.EvaluationWhereInput {
    const filters: Prisma.EvaluationWhereInput[] = [];
    if (query.campaignId) filters.push({ campaignId: query.campaignId });
    if (query.evaluatorType) filters.push({ evaluatorType: query.evaluatorType });
    if (query.targetType) filters.push({ targetType: query.targetType });
    if (query.status) filters.push({ status: query.status });
    if (query.evaluatorId) filters.push({ evaluatorId: query.evaluatorId });
    if (query.targetId) filters.push({ targetId: query.targetId });
    if (query.q) {
      filters.push({
        OR: [
          { evaluator: { fullName: containsInsensitive(query.q) } },
          { target: { fullName: containsInsensitive(query.q) } },
          { campaign: { title: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) return {};
    return filters.length === 1 ? filters[0] : { AND: filters };
  }
}
