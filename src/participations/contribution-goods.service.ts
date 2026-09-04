import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContributionGoodDto } from './dto/create-contribution-good.dto';
import { FindContributionGoodsQueryDto } from './dto/find-contribution-goods-query.dto';
import { UpdateContributionGoodDto } from './dto/update-contribution-good.dto';

@Injectable()
export class ContributionGoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindContributionGoodsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.contributionGood.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.contributionGood.findMany({ where, orderBy, skip, take }),
      this.prisma.contributionGood.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.contributionGood.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('کالا یافت نشد');
    }
    return item;
  }

  async create(dto: CreateContributionGoodDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.contributionGood.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.contributionGood.create({
      data: { name, isActive: dto.isActive ?? true },
    });
  }

  async update(id: string, dto: UpdateContributionGoodDto) {
    await this.findOne(id);
    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.contributionGood.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('کالایی با این نام قبلاً ثبت شده است');
      }
    }
    return this.prisma.contributionGood.update({
      where: { id },
      data: {
        name,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const used = await this.prisma.contribution.count({
      where: { goodsId: id },
    });
    if (used) {
      throw new BadRequestException('این کالا در مشارکت‌ها استفاده شده و قابل حذف نیست');
    }
    await this.prisma.contributionGood.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindContributionGoodsQueryDto,
  ): Prisma.ContributionGoodWhereInput {
    const filters: Prisma.ContributionGoodWhereInput[] = [];
    if (query.isActive != null) {
      filters.push({ isActive: query.isActive });
    }
    if (query.q) {
      filters.push({ name: containsInsensitive(query.q) });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindContributionGoodsQueryDto,
  ): Prisma.ContributionGoodOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ContributionGoodOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        isActive: (dir) => ({ isActive: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }
}
