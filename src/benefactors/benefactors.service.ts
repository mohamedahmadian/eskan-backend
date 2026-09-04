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
import { ANONYMOUS_BENEFACTOR_CODE } from './anonymous-benefactor';
import { CreateBenefactorDto } from './dto/create-benefactor.dto';
import { FindBenefactorsQueryDto } from './dto/find-benefactors-query.dto';
import { UpdateBenefactorDto } from './dto/update-benefactor.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const benefactorInclude = {
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
} satisfies Prisma.BenefactorInclude;

type BenefactorRecord = Prisma.BenefactorGetPayload<{
  include: typeof benefactorInclude;
}>;

@Injectable()
export class BenefactorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindBenefactorsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.benefactor.findMany({
        where,
        orderBy,
        include: benefactorInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.benefactor.findMany({
        where,
        orderBy,
        skip,
        take,
        include: benefactorInclude,
      }),
      this.prisma.benefactor.count({ where }),
    ]);
    return paginatedResult(items.map((item) => this.serialize(item)), total, page, pageSize);
  }

  private listOrderBy(
    query: FindBenefactorsQueryDto,
  ): Prisma.BenefactorOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.BenefactorOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        firstName: (dir) => ({ firstName: dir }),
        lastName: (dir) => ({ lastName: dir }),
        nationalId: (dir) => ({ nationalId: dir }),
        phone: (dir) => ({ phone: dir }),
        province: (dir) => ({ province: { nameFa: dir } }),
        city: (dir) => ({ city: { nameFa: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.benefactor.findUnique({
      where: { id },
      include: benefactorInclude,
    });
    if (!item) {
      throw new NotFoundException('خیر یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateBenefactorDto) {
    const geo = await this.resolveGeo(dto.provinceId, dto.cityId);
    const firstName = dto.firstName.trim();
    const lastName = (dto.lastName ?? '').trim();
    const item = await this.prisma.benefactor.create({
      data: {
        firstName,
        lastName,
        name: fullName(firstName, lastName),
        nationalId: dto.nationalId?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        neshanAddress: dto.neshanAddress?.trim() || null,
        latitude: toDecimal(dto.latitude),
        longitude: toDecimal(dto.longitude),
        description: dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: benefactorInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateBenefactorDto) {
    const current = await this.findOne(id);
    const provinceId =
      dto.provinceId === undefined ? current.provinceId : dto.provinceId;
    const cityId = dto.cityId === undefined ? current.cityId : dto.cityId;
    const geo = await this.resolveGeo(provinceId, cityId);
    const firstName = dto.firstName?.trim() ?? current.firstName;
    const lastName = dto.lastName?.trim() ?? current.lastName;
    const item = await this.prisma.benefactor.update({
      where: { id },
      data: {
        firstName,
        lastName,
        name: fullName(firstName, lastName),
        nationalId:
          dto.nationalId === undefined
            ? undefined
            : dto.nationalId?.trim() || null,
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
      include: benefactorInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    const current = await this.findOne(id);
    if (current.code === ANONYMOUS_BENEFACTOR_CODE) {
      throw new BadRequestException('خیر پیش‌فرض «ناشناس» قابل حذف نیست');
    }
    const used = await this.prisma.contribution.count({
      where: { benefactorId: id },
    });
    if (used) {
      throw new BadRequestException(
        'این خیر در مشارکت‌ها ثبت شده و قابل حذف نیست',
      );
    }
    await this.prisma.benefactor.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindBenefactorsQueryDto,
  ): Prisma.BenefactorWhereInput {
    const filters: Prisma.BenefactorWhereInput[] = [];
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    } else if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { firstName: containsInsensitive(query.q) },
          { lastName: containsInsensitive(query.q) },
          { nationalId: containsInsensitive(query.q) },
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

  private async resolveGeo(
    provinceId?: string | null,
    cityId?: string | null,
  ) {
    if (!provinceId && !cityId) {
      return { provinceId: null, cityId: null };
    }
    if (!provinceId || !cityId) {
      throw new BadRequestException('استان و شهر را با هم انتخاب کنید');
    }
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

  private serialize(item: BenefactorRecord) {
    return {
      ...item,
      latitude: toCoord(item.latitude),
      longitude: toCoord(item.longitude),
    };
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
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
