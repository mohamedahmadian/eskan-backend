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
import { CreatePlaceTypeDto } from './dto/create-place-type.dto';
import { FindPlaceTypesQueryDto } from './dto/find-place-types-query.dto';
import { UpdatePlaceTypeDto } from './dto/update-place-type.dto';

const placeTypeInclude = {
  _count: { select: { places: true } },
} satisfies Prisma.PlaceTypeInclude;

type PlaceTypeRecord = Prisma.PlaceTypeGetPayload<{
  include: typeof placeTypeInclude;
}>;

@Injectable()
export class PlaceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindPlaceTypesQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.placeType.findMany({
        where,
        orderBy,
        include: placeTypeInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.placeType.findMany({
        where,
        orderBy,
        skip,
        take,
        include: placeTypeInclude,
      }),
      this.prisma.placeType.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.placeType.findUnique({
      where: { id },
      include: placeTypeInclude,
    });
    if (!item) {
      throw new NotFoundException('نوع مکان یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreatePlaceTypeDto) {
    await this.assertUniqueCode(dto.code);
    const item = await this.prisma.placeType.create({
      data: {
        code: normalizeCode(dto.code),
        nameFa: dto.nameFa.trim(),
        nameEn: dto.nameEn.trim(),
        icon: dto.icon?.trim() || 'landmark',
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: placeTypeInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdatePlaceTypeDto) {
    await this.findOne(id);
    if (dto.code) {
      await this.assertUniqueCode(dto.code, id);
    }
    const item = await this.prisma.placeType.update({
      where: { id },
      data: {
        code: dto.code === undefined ? undefined : normalizeCode(dto.code),
        nameFa: dto.nameFa?.trim(),
        nameEn: dto.nameEn?.trim(),
        icon: dto.icon === undefined ? undefined : dto.icon?.trim() || 'landmark',
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
      include: placeTypeInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    if (item._count.places > 0) {
      throw new BadRequestException(
        'این نوع مکان دارای مکان ثبت‌شده است و قابل حذف نیست',
      );
    }
    await this.prisma.placeType.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindPlaceTypesQueryDto): Prisma.PlaceTypeWhereInput {
    const filters: Prisma.PlaceTypeWhereInput[] = [];
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
    query: FindPlaceTypesQueryDto,
  ): Prisma.PlaceTypeOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.PlaceTypeOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        nameFa: (dir) => ({ nameFa: dir }),
        code: (dir) => ({ code: dir }),
        sortOrder: (dir) => ({ sortOrder: dir }),
        isActive: (dir) => ({ isActive: dir }),
        placeCount: (dir) => ({ places: { _count: dir } }),
      },
      [{ sortOrder: 'asc' }, { nameFa: 'asc' }, { id: 'asc' }],
    );
  }

  private async assertUniqueCode(code: string, excludeId?: string) {
    const existing = await this.prisma.placeType.findUnique({
      where: { code: normalizeCode(code) },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('کد نوع مکان تکراری است');
    }
  }

  private serialize(item: PlaceTypeRecord) {
    return item;
  }
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}
