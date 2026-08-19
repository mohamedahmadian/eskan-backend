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
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRedCrescentDto } from './dto/create-red-crescent.dto';
import { FindRedCrescentsQueryDto } from './dto/find-red-crescents-query.dto';
import { UpdateRedCrescentDto } from './dto/update-red-crescent.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const redCrescentInclude = {
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
} satisfies Prisma.RedCrescentInclude;

type RedCrescentRecord = Prisma.RedCrescentGetPayload<{
  include: typeof redCrescentInclude;
}>;

@Injectable()
export class RedCrescentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindRedCrescentsQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.redCrescent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: redCrescentInclude,
      }),
      this.prisma.redCrescent.count({ where }),
    ]);
    return paginatedResult(items.map((item) => this.serialize(item)), total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.redCrescent.findUnique({
      where: { id },
      include: redCrescentInclude,
    });
    if (!item) {
      throw new NotFoundException('شعبه هلال احمر یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateRedCrescentDto) {
    const geo = await this.resolveGeo(dto.provinceId, dto.cityId);
    const item = await this.prisma.redCrescent.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        neshanAddress: dto.neshanAddress?.trim() || null,
        latitude: toDecimal(dto.latitude),
        longitude: toDecimal(dto.longitude),
        description: dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: redCrescentInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateRedCrescentDto) {
    const current = await this.findOne(id);
    const provinceId = dto.provinceId ?? current.provinceId;
    const cityId = dto.cityId ?? current.cityId;
    const geo = await this.resolveGeo(provinceId, cityId);
    const item = await this.prisma.redCrescent.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
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
      include: redCrescentInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.redCrescent.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindRedCrescentsQueryDto,
  ): Prisma.RedCrescentWhereInput {
    const filters: Prisma.RedCrescentWhereInput[] = [];
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
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
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

  private serialize(item: RedCrescentRecord) {
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
