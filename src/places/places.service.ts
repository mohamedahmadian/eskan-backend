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
import { CreatePlaceDto } from './dto/create-place.dto';
import { FindPlacesQueryDto } from './dto/find-places-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const placeInclude = {
  placeType: {
    select: {
      id: true,
      code: true,
      nameFa: true,
      nameEn: true,
      icon: true,
      isActive: true,
    },
  },
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
} satisfies Prisma.PlaceInclude;

type PlaceRecord = Prisma.PlaceGetPayload<{
  include: typeof placeInclude;
}>;

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindPlacesQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.place.findMany({
        where,
        orderBy,
        include: placeInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.place.findMany({
        where,
        orderBy,
        skip,
        take,
        include: placeInclude,
      }),
      this.prisma.place.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.place.findUnique({
      where: { id },
      include: placeInclude,
    });
    if (!item) {
      throw new NotFoundException('مکان مهم یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreatePlaceDto) {
    const geo = await this.resolveGeo(dto.provinceId, dto.cityId);
    await this.assertPlaceType(dto.placeTypeId);
    const item = await this.prisma.place.create({
      data: {
        name: dto.name.trim(),
        placeTypeId: dto.placeTypeId,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        neshanAddress: dto.neshanAddress?.trim() || null,
        latitude: toDecimal(dto.latitude),
        longitude: toDecimal(dto.longitude),
        description: dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: placeInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdatePlaceDto) {
    const current = await this.findOne(id);
    const provinceId = dto.provinceId ?? current.provinceId;
    const cityId = dto.cityId ?? current.cityId;
    const geo = await this.resolveGeo(provinceId, cityId);
    if (dto.placeTypeId) {
      await this.assertPlaceType(dto.placeTypeId);
    }
    const item = await this.prisma.place.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        placeTypeId: dto.placeTypeId,
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        neshanAddress:
          dto.neshanAddress === undefined
            ? undefined
            : dto.neshanAddress?.trim() || null,
        latitude: toDecimal(dto.latitude),
        longitude: toDecimal(dto.longitude),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: placeInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.place.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindPlacesQueryDto): Prisma.PlaceWhereInput {
    const filters: Prisma.PlaceWhereInput[] = [];
    if (query.placeTypeId) {
      filters.push({ placeTypeId: query.placeTypeId });
    }
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    } else if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { neshanAddress: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { placeType: { nameFa: containsInsensitive(query.q) } },
          { placeType: { nameEn: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindPlacesQueryDto,
  ): Prisma.PlaceOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.PlaceOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        phone: (dir) => ({ phone: dir }),
        placeType: (dir) => ({ placeType: { nameFa: dir } }),
        province: (dir) => ({ province: { nameFa: dir } }),
        city: (dir) => ({ city: { nameFa: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private async resolveGeo(provinceId: string, cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, provinceId: true },
    });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (city.provinceId !== provinceId) {
      throw new BadRequestException('شهر انتخاب‌شده متعلق به این استان نیست');
    }
    return { provinceId: city.provinceId, cityId: city.id };
  }

  private async assertPlaceType(placeTypeId: string) {
    const type = await this.prisma.placeType.findUnique({
      where: { id: placeTypeId },
      select: { id: true },
    });
    if (!type) {
      throw new BadRequestException('نوع مکان معتبر نیست');
    }
  }

  private serialize(item: PlaceRecord) {
    return {
      ...item,
      latitude: toCoord(item.latitude),
      longitude: toCoord(item.longitude),
    };
  }
}

function toDecimal(value?: number | null) {
  if (value === undefined) {
    return undefined;
  }
  return value == null ? null : new Prisma.Decimal(value);
}

function toCoord(value: Prisma.Decimal | null) {
  return value == null ? null : Number(value);
}
