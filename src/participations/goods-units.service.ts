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
import { CreateGoodsUnitDto } from './dto/create-goods-unit.dto';
import { FindGoodsUnitsQueryDto } from './dto/find-goods-units-query.dto';
import { UpdateGoodsUnitDto } from './dto/update-goods-unit.dto';

@Injectable()
export class GoodsUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindGoodsUnitsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.goodsUnit.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.goodsUnit.findMany({ where, orderBy, skip, take }),
      this.prisma.goodsUnit.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.goodsUnit.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('واحد کالا یافت نشد');
    }
    return item;
  }

  async create(dto: CreateGoodsUnitDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.goodsUnit.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.goodsUnit.create({
      data: { name, isActive: dto.isActive ?? true },
    });
  }

  async update(id: string, dto: UpdateGoodsUnitDto) {
    await this.findOne(id);
    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.goodsUnit.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('واحدی با این نام قبلاً ثبت شده است');
      }
    }
    return this.prisma.goodsUnit.update({
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
      where: { unitId: id },
    });
    if (used) {
      throw new BadRequestException('این واحد در مشارکت‌ها استفاده شده و قابل حذف نیست');
    }
    await this.prisma.goodsUnit.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindGoodsUnitsQueryDto): Prisma.GoodsUnitWhereInput {
    const filters: Prisma.GoodsUnitWhereInput[] = [];
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
    query: FindGoodsUnitsQueryDto,
  ): Prisma.GoodsUnitOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.GoodsUnitOrderByWithRelationInput>(
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
