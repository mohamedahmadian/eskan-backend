import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { currentJalaliYear } from '../common/jalali-year';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeadquartersInfoDto } from './dto/create-headquarters-info.dto';
import { FindHeadquartersInfoQueryDto } from './dto/find-headquarters-info-query.dto';
import { UpdateHeadquartersInfoDto } from './dto/update-headquarters-info.dto';

const headquartersPhoneOrder = [
  { createdAt: 'asc' as const },
  { id: 'asc' as const },
];

const headquartersListInclude = {
  _count: { select: { phones: true } },
} satisfies Prisma.HeadquartersInfoInclude;

const headquartersDetailInclude = {
  phones: { orderBy: headquartersPhoneOrder },
  _count: { select: { phones: true } },
} satisfies Prisma.HeadquartersInfoInclude;

type HeadquartersListRecord = Prisma.HeadquartersInfoGetPayload<{
  include: typeof headquartersListInclude;
}>;

type HeadquartersDetailRecord = Prisma.HeadquartersInfoGetPayload<{
  include: typeof headquartersDetailInclude;
}>;

@Injectable()
export class HeadquartersInfoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindHeadquartersInfoQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersInfo.findMany({
        where,
        orderBy,
        skip,
        take,
        include: headquartersListInclude,
      }),
      this.prisma.headquartersInfo.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersInfo.findUnique({
      where: { id },
      include: headquartersDetailInclude,
    });
    if (!item) {
      throw new NotFoundException('اطلاعات ستاد یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateHeadquartersInfoDto) {
    const existing = await this.prisma.headquartersInfo.count();
    if (existing > 0) {
      throw new ConflictException('فقط یک ستاد قابل تعریف است');
    }
    await this.assertLogo(dto.logoId);
    const item = await this.prisma.headquartersInfo.create({
      data: {
        name: dto.name.trim(),
        title: dto.title?.trim() || null,
        address: dto.address?.trim() || null,
        neshanAddress: dto.neshanAddress?.trim() || null,
        ...this.coordsData(dto),
        description: dto.description?.trim() || null,
        activityStartYear: dto.activityStartYear,
        website: dto.website?.trim() || null,
        eitaa: dto.eitaa?.trim() || null,
        bale: dto.bale?.trim() || null,
        telegram: dto.telegram?.trim() || null,
        instagram: dto.instagram?.trim() || null,
        logoId: dto.logoId || null,
      },
      include: headquartersDetailInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateHeadquartersInfoDto) {
    await this.findOne(id);
    if (dto.logoId !== undefined) {
      await this.assertLogo(dto.logoId);
    }
    const item = await this.prisma.headquartersInfo.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        title: dto.title === undefined ? undefined : dto.title?.trim() || null,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        neshanAddress:
          dto.neshanAddress === undefined
            ? undefined
            : dto.neshanAddress?.trim() || null,
        ...this.coordsData(dto, true),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        activityStartYear: dto.activityStartYear,
        website:
          dto.website === undefined ? undefined : dto.website?.trim() || null,
        eitaa: dto.eitaa === undefined ? undefined : dto.eitaa?.trim() || null,
        bale: dto.bale === undefined ? undefined : dto.bale?.trim() || null,
        telegram:
          dto.telegram === undefined ? undefined : dto.telegram?.trim() || null,
        instagram:
          dto.instagram === undefined
            ? undefined
            : dto.instagram?.trim() || null,
        logoId: dto.logoId === undefined ? undefined : dto.logoId || null,
      },
      include: headquartersDetailInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.headquartersInfo.delete({ where: { id } });
    return { ok: true };
  }

  async summary() {
    const currentYear = currentJalaliYear();
    const item = await this.prisma.headquartersInfo.findFirst({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        name: true,
        title: true,
        address: true,
        neshanAddress: true,
        latitude: true,
        longitude: true,
        description: true,
        activityStartYear: true,
        website: true,
        eitaa: true,
        bale: true,
        telegram: true,
        instagram: true,
        logoId: true,
        phones: {
          orderBy: headquartersPhoneOrder,
          select: { id: true, phone: true, department: true },
        },
      },
    });
    const activityStartYear = item?.activityStartYear ?? null;
    return {
      name: item?.name ?? null,
      title: item?.title ?? null,
      address: item?.address ?? null,
      neshanAddress: item?.neshanAddress ?? null,
      latitude: item?.latitude == null ? null : Number(item.latitude),
      longitude: item?.longitude == null ? null : Number(item.longitude),
      description: item?.description ?? null,
      activityStartYear,
      currentYear,
      yearsOfService:
        activityStartYear == null
          ? null
          : Math.max(0, currentYear - activityStartYear),
      website: item?.website ?? null,
      eitaa: item?.eitaa ?? null,
      bale: item?.bale ?? null,
      telegram: item?.telegram ?? null,
      instagram: item?.instagram ?? null,
      logoId: item?.logoId ?? null,
      phones: item?.phones ?? [],
    };
  }

  private listOrderBy(
    query: FindHeadquartersInfoQueryDto,
  ): Prisma.HeadquartersInfoOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HeadquartersInfoOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        title: (dir) => ({ title: dir }),
        address: (dir) => ({ address: dir }),
        neshanAddress: (dir) => ({ neshanAddress: dir }),
        activityStartYear: (dir) => ({ activityStartYear: dir }),
        phoneCount: (dir) => ({ phones: { _count: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: FindHeadquartersInfoQueryDto,
  ): Prisma.HeadquartersInfoWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { title: containsInsensitive(query.q) },
        { address: containsInsensitive(query.q) },
        { neshanAddress: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { website: containsInsensitive(query.q) },
        { eitaa: containsInsensitive(query.q) },
        { bale: containsInsensitive(query.q) },
        { telegram: containsInsensitive(query.q) },
        { instagram: containsInsensitive(query.q) },
        { phones: { some: { phone: containsInsensitive(query.q) } } },
        { phones: { some: { department: containsInsensitive(query.q) } } },
      ],
    };
  }

  private coordsData(
    dto: Pick<CreateHeadquartersInfoDto, 'latitude' | 'longitude'>,
    partial = false,
  ) {
    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (!partial && (dto.latitude == null) !== (dto.longitude == null)) {
      throw new BadRequestException('موقعیت جغرافیایی ناقص است');
    }
    if (partial && hasLat !== hasLng) {
      throw new BadRequestException('موقعیت جغرافیایی ناقص است');
    }
    if (partial && !hasLat && !hasLng) {
      return {};
    }
    if ((dto.latitude == null) !== (dto.longitude == null)) {
      throw new BadRequestException('موقعیت جغرافیایی ناقص است');
    }
    return {
      latitude:
        dto.latitude == null ? null : new Prisma.Decimal(dto.latitude),
      longitude:
        dto.longitude == null ? null : new Prisma.Decimal(dto.longitude),
    };
  }

  private async assertLogo(logoId?: string | null) {
    if (!logoId) {
      return;
    }
    const image = await this.prisma.storedImage.findUnique({
      where: { id: logoId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('لوگوی انتخاب‌شده معتبر نیست');
    }
  }

  private serialize(item: HeadquartersListRecord | HeadquartersDetailRecord) {
    const phones = 'phones' in item ? item.phones : undefined;
    return {
      id: item.id,
      name: item.name,
      title: item.title,
      address: item.address,
      neshanAddress: item.neshanAddress,
      latitude: item.latitude == null ? null : Number(item.latitude),
      longitude: item.longitude == null ? null : Number(item.longitude),
      description: item.description,
      activityStartYear: item.activityStartYear,
      website: item.website,
      eitaa: item.eitaa,
      bale: item.bale,
      telegram: item.telegram,
      instagram: item.instagram,
      logoId: item.logoId,
      phoneCount: item._count.phones,
      phones,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
