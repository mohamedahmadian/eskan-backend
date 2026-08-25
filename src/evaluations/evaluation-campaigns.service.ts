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
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEvaluationCampaignDto,
  FindEvaluationCampaignsQueryDto,
  UpdateEvaluationCampaignDto,
} from './dto/create-evaluation-campaign.dto';

function parseDateOnly(value: string, field: string) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException(`${field} معتبر نیست`);
  }
  return new Date(`${day}T00:00:00.000Z`);
}

@Injectable()
export class EvaluationCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindEvaluationCampaignsQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = resolveSortOrder<Prisma.EvaluationCampaignOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        title: (dir) => ({ title: dir }),
        startAt: (dir) => ({ startAt: dir }),
        endAt: (dir) => ({ endAt: dir }),
        status: (dir) => ({ status: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
    const [items, total] = await Promise.all([
      this.prisma.evaluationCampaign.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { _count: { select: { evaluations: true } } },
      }),
      this.prisma.evaluationCampaign.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findActive() {
    const today = new Date();
    const day = today.toISOString().slice(0, 10);
    const dayDate = new Date(`${day}T00:00:00.000Z`);
    return this.prisma.evaluationCampaign.findMany({
      where: {
        status: 'ACTIVE',
        startAt: { lte: dayDate },
        endAt: { gte: dayDate },
      },
      orderBy: [{ startAt: 'desc' }, { title: 'asc' }],
      include: { _count: { select: { evaluations: true } } },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.evaluationCampaign.findUnique({
      where: { id },
      include: { _count: { select: { evaluations: true } } },
    });
    if (!item) {
      throw new NotFoundException('دوره ارزیابی یافت نشد');
    }
    return item;
  }

  async create(dto: CreateEvaluationCampaignDto) {
    const startAt = parseDateOnly(dto.startAt, 'تاریخ شروع');
    const endAt = parseDateOnly(dto.endAt, 'تاریخ پایان');
    if (endAt < startAt) {
      throw new BadRequestException('تاریخ پایان نمی‌تواند قبل از شروع باشد');
    }
    return this.prisma.evaluationCampaign.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        status: dto.status ?? 'DRAFT',
      },
      include: { _count: { select: { evaluations: true } } },
    });
  }

  async update(id: string, dto: UpdateEvaluationCampaignDto) {
    const current = await this.findOne(id);
    const startAt = dto.startAt
      ? parseDateOnly(dto.startAt, 'تاریخ شروع')
      : current.startAt;
    const endAt = dto.endAt
      ? parseDateOnly(dto.endAt, 'تاریخ پایان')
      : current.endAt;
    if (endAt < startAt) {
      throw new BadRequestException('تاریخ پایان نمی‌تواند قبل از شروع باشد');
    }
    return this.prisma.evaluationCampaign.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt ? endAt : undefined,
        status: dto.status,
      },
      include: { _count: { select: { evaluations: true } } },
    });
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    if (item._count.evaluations > 0) {
      throw new BadRequestException(
        'دوره‌ای که ارزیابی ثبت‌شده دارد قابل حذف نیست؛ آن را ببندید',
      );
    }
    await this.prisma.evaluationCampaign.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindEvaluationCampaignsQueryDto,
  ): Prisma.EvaluationCampaignWhereInput {
    const filters: Prisma.EvaluationCampaignWhereInput[] = [];
    if (query.status) {
      filters.push({ status: query.status });
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
