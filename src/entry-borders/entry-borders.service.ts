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
import { CreateEntryBorderDto } from './dto/create-entry-border.dto';
import { FindEntryBordersQueryDto } from './dto/find-entry-borders-query.dto';
import { UpdateEntryBorderDto } from './dto/update-entry-border.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const entryBorderInclude = {
  neighboringCountry: {
    select: { ...geoSelect, iso2: true },
  },
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
} satisfies Prisma.EntryBorderInclude;

@Injectable()
export class EntryBordersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindEntryBordersQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.entryBorder.findMany({
        where,
        orderBy,
        include: entryBorderInclude,
      });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.entryBorder.findMany({
        where,
        orderBy,
        skip,
        take,
        include: entryBorderInclude,
      }),
      this.prisma.entryBorder.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindEntryBordersQueryDto,
  ): Prisma.EntryBorderOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.EntryBorderOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        neighboringCountry: (dir) => ({
          neighboringCountry: { nameFa: dir },
        }),
        province: (dir) => ({ province: { nameFa: dir } }),
        city: (dir) => ({ city: { nameFa: dir } }),
        borderType: (dir) => ({ borderType: dir }),
        isActive: (dir) => ({ isActive: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.entryBorder.findUnique({
      where: { id },
      include: entryBorderInclude,
    });
    if (!item) {
      throw new NotFoundException('مرز ورودی یافت نشد');
    }
    return item;
  }

  async create(dto: CreateEntryBorderDto) {
    const relations = await this.resolveRelations(dto);
    return this.prisma.entryBorder.create({
      data: {
        name: dto.name.trim(),
        neighboringCountryId: relations.neighboringCountryId,
        provinceId: relations.provinceId,
        cityId: relations.cityId,
        borderType: dto.borderType,
        isActive: dto.isActive ?? true,
        description: dto.description?.trim() || null,
      },
      include: entryBorderInclude,
    });
  }

  async update(id: string, dto: UpdateEntryBorderDto) {
    const current = await this.findOne(id);
    const relations = await this.resolveRelations({
      neighboringCountryId:
        dto.neighboringCountryId ?? current.neighboringCountryId,
      provinceId: dto.provinceId ?? current.provinceId,
      cityId: dto.cityId ?? current.cityId,
    });
    return this.prisma.entryBorder.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        neighboringCountryId: relations.neighboringCountryId,
        provinceId: relations.provinceId,
        cityId: relations.cityId,
        borderType: dto.borderType,
        isActive: dto.isActive,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: entryBorderInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const routeCount = await this.prisma.walkingRoute.count({
      where: { entryBorderId: id },
    });
    if (routeCount) {
      throw new BadRequestException(
        'ابتدا مسیرهای پیاده متصل به این مرز را اصلاح کنید',
      );
    }
    await this.prisma.entryBorder.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindEntryBordersQueryDto,
  ): Prisma.EntryBorderWhereInput {
    const filters: Prisma.EntryBorderWhereInput[] = [];
    if (query.neighboringCountryId) {
      filters.push({ neighboringCountryId: query.neighboringCountryId });
    }
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    } else if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.borderType) {
      filters.push({ borderType: query.borderType });
    }
    if (query.isActive != null) {
      filters.push({ isActive: query.isActive });
    } else if (query.activeOnly) {
      filters.push({ isActive: true });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { neighboringCountry: { nameFa: containsInsensitive(query.q) } },
          { neighboringCountry: { nameEn: containsInsensitive(query.q) } },
          { province: { nameFa: containsInsensitive(query.q) } },
          { city: { nameFa: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async resolveRelations(dto: {
    neighboringCountryId: string;
    provinceId: string;
    cityId: string;
  }) {
    const [country, city] = await Promise.all([
      this.prisma.country.findUnique({
        where: { id: dto.neighboringCountryId },
        select: { id: true },
      }),
      this.prisma.city.findUnique({
        where: { id: dto.cityId },
        select: { id: true, provinceId: true },
      }),
    ]);
    if (!country) {
      throw new BadRequestException('کشور هم‌مرز معتبر نیست');
    }
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (city.provinceId !== dto.provinceId) {
      throw new BadRequestException('شهر انتخاب‌شده متعلق به این استان نیست');
    }
    return {
      neighboringCountryId: country.id,
      provinceId: city.provinceId,
      cityId: city.id,
    };
  }
}
