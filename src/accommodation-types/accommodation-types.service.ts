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
import { CreateAccommodationTypeDto } from './dto/create-accommodation-type.dto';
import { FindAccommodationTypesQueryDto } from './dto/find-accommodation-types-query.dto';
import { UpdateAccommodationTypeDto } from './dto/update-accommodation-type.dto';

const accommodationTypeInclude = {
  _count: { select: { accommodations: true } },
} satisfies Prisma.AccommodationTypeInclude;

type AccommodationTypeRecord = Prisma.AccommodationTypeGetPayload<{
  include: typeof accommodationTypeInclude;
}>;

@Injectable()
export class AccommodationTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindAccommodationTypesQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.accommodationType.findMany({
        where,
        orderBy,
        include: accommodationTypeInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodationType.findMany({
        where,
        orderBy,
        skip,
        take,
        include: accommodationTypeInclude,
      }),
      this.prisma.accommodationType.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.accommodationType.findUnique({
      where: { id },
      include: accommodationTypeInclude,
    });
    if (!item) {
      throw new NotFoundException('نوع اسکان یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateAccommodationTypeDto) {
    await this.assertUniqueCode(dto.code);
    const item = await this.prisma.accommodationType.create({
      data: {
        code: normalizeCode(dto.code),
        nameFa: dto.nameFa.trim(),
        nameEn: dto.nameEn.trim(),
        icon: dto.icon?.trim() || 'building-2',
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: accommodationTypeInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateAccommodationTypeDto) {
    await this.findOne(id);
    if (dto.code) {
      await this.assertUniqueCode(dto.code, id);
    }
    const item = await this.prisma.accommodationType.update({
      where: { id },
      data: {
        code: dto.code === undefined ? undefined : normalizeCode(dto.code),
        nameFa: dto.nameFa?.trim(),
        nameEn: dto.nameEn?.trim(),
        icon: dto.icon === undefined ? undefined : dto.icon?.trim() || 'building-2',
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
      include: accommodationTypeInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    if (item._count.accommodations > 0) {
      throw new BadRequestException(
        'این نوع اسکان دارای محل ثبت‌شده است و قابل حذف نیست',
      );
    }
    await this.prisma.accommodationType.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindAccommodationTypesQueryDto,
  ): Prisma.AccommodationTypeWhereInput {
    const filters: Prisma.AccommodationTypeWhereInput[] = [];
    if (query.activeOnly) {
      filters.push({ isActive: true });
    }
    if (query.q) {
      filters.push({
        OR: [
          { nameFa: containsInsensitive(query.q) },
          { nameEn: containsInsensitive(query.q) },
          { code: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindAccommodationTypesQueryDto,
  ): Prisma.AccommodationTypeOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.AccommodationTypeOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        nameFa: (dir) => ({ nameFa: dir }),
        code: (dir) => ({ code: dir }),
        sortOrder: (dir) => ({ sortOrder: dir }),
        isActive: (dir) => ({ isActive: dir }),
        accommodationCount: (dir) => ({ accommodations: { _count: dir } }),
      },
      [{ sortOrder: 'asc' }, { nameFa: 'asc' }, { id: 'asc' }],
    );
  }

  private async assertUniqueCode(code: string, excludeId?: string) {
    const existing = await this.prisma.accommodationType.findUnique({
      where: { code: normalizeCode(code) },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('کد نوع اسکان تکراری است');
    }
  }

  private serialize(item: AccommodationTypeRecord) {
    return item;
  }
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}
