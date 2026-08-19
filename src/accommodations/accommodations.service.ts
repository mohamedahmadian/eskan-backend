import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import {
  Prisma,
  type AccommodationStatus,
  type AccommodationType,
  type GenderType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const accommodationInclude = {
  country: { select: geoSelect },
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
  managers: {
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
    include: {
      user: { select: { id: true, username: true, fullName: true } },
    },
  },
} satisfies Prisma.AccommodationInclude;

type Actor = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

type AccommodationRecord = Prisma.AccommodationGetPayload<{
  include: typeof accommodationInclude;
}>;

@Injectable()
export class AccommodationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindAccommodationsQueryDto, actor: Actor) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query, actor);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: accommodationInclude,
      }),
      this.prisma.accommodation.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string, actor: Actor) {
    const item = await this.prisma.accommodation.findUnique({
      where: { id },
      include: accommodationInclude,
    });
    if (!item || !this.canAccess(item, actor)) {
      throw new NotFoundException('اسکان یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateAccommodationDto, actor: Actor) {
    this.assertCapacity(dto);
    const geo = await this.resolveGeo(dto);
    const admin = isAdmin(actor);
    const managerIds = admin
      ? [...new Set(dto.managerUserIds ?? [])]
      : [actor.id];
    const wantsPrimary = admin
      ? Boolean(dto.primaryManagerUserId)
      : dto.isPrimary !== false;

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.accommodation.create({
        data: this.toData(dto, geo) as Prisma.AccommodationUncheckedCreateInput,
      });
      await this.syncManagers(tx, {
        accommodationId: row.id,
        managerUserIds: managerIds,
        primaryUserId: admin
          ? (dto.primaryManagerUserId ?? null)
          : wantsPrimary
            ? actor.id
            : null,
        actorId: actor.id,
        forcePrimaryIfFirst: !admin,
      });
      return tx.accommodation.findUniqueOrThrow({
        where: { id: row.id },
        include: accommodationInclude,
      });
    });

    return this.serialize(created);
  }

  async update(id: string, dto: UpdateAccommodationDto, actor: Actor) {
    const current = await this.findRecord(id, actor);
    this.assertCapacity({
      maleCapacity: dto.maleCapacity ?? current.maleCapacity,
      femaleCapacity: dto.femaleCapacity ?? current.femaleCapacity,
      assignedMaleCapacity:
        dto.assignedMaleCapacity ?? current.assignedMaleCapacity,
      assignedFemaleCapacity:
        dto.assignedFemaleCapacity ?? current.assignedFemaleCapacity,
    });
    const geo = await this.resolveGeo({
      countryId: dto.countryId === undefined ? current.countryId : dto.countryId,
      provinceId:
        dto.provinceId === undefined ? current.provinceId : dto.provinceId,
      cityId: dto.cityId === undefined ? current.cityId : dto.cityId,
    });
    const admin = isAdmin(actor);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accommodation.update({
        where: { id },
        data: this.toData(dto, geo, true) as Prisma.AccommodationUncheckedUpdateInput,
      });
      if (admin && (dto.managerUserIds || dto.primaryManagerUserId !== undefined)) {
        const managerIds = dto.managerUserIds
          ? [...new Set(dto.managerUserIds)]
          : current.managers.map((item) => item.userId);
        await this.syncManagers(tx, {
          accommodationId: id,
          managerUserIds: managerIds,
          primaryUserId:
            dto.primaryManagerUserId === undefined
              ? (current.managers.find((item) => item.isPrimary)?.userId ?? null)
              : dto.primaryManagerUserId,
          actorId: actor.id,
          forcePrimaryIfFirst: false,
        });
      } else if (!admin && dto.isPrimary === true) {
        await this.setUserPrimary(tx, actor.id, id);
      }
      return tx.accommodation.findUniqueOrThrow({
        where: { id },
        include: accommodationInclude,
      });
    });

    return this.serialize(updated);
  }

  async remove(id: string, actor: Actor) {
    await this.findRecord(id, actor);
    await this.prisma.accommodation.delete({ where: { id } });
    return { ok: true };
  }

  private async findRecord(id: string, actor: Actor) {
    const item = await this.prisma.accommodation.findUnique({
      where: { id },
      include: accommodationInclude,
    });
    if (!item || !this.canAccess(item, actor)) {
      throw new NotFoundException('اسکان یافت نشد');
    }
    return item;
  }

  private listWhere(
    query: FindAccommodationsQueryDto,
    actor: Actor,
  ): Prisma.AccommodationWhereInput {
    const filters: Prisma.AccommodationWhereInput[] = [];
    if (!isAdmin(actor)) {
      filters.push({ managers: { some: { userId: actor.id } } });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { neshanAddress: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { eitaa: containsInsensitive(query.q) },
          { bale: containsInsensitive(query.q) },
          { otherSocial: containsInsensitive(query.q) },
          { heatingSystem: containsInsensitive(query.q) },
          { coolingSystem: containsInsensitive(query.q) },
          { country: { nameFa: containsInsensitive(query.q) } },
          { country: { nameEn: containsInsensitive(query.q) } },
          { province: { nameFa: containsInsensitive(query.q) } },
          { province: { nameEn: containsInsensitive(query.q) } },
          { city: { nameFa: containsInsensitive(query.q) } },
          { city: { nameEn: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private canAccess(item: { managers: { userId: string }[] }, actor: Actor) {
    return isAdmin(actor) || item.managers.some((row) => row.userId === actor.id);
  }

  private assertCapacity(dto: {
    maleCapacity?: number;
    femaleCapacity?: number;
    assignedMaleCapacity?: number;
    assignedFemaleCapacity?: number;
  }) {
    const male = dto.maleCapacity ?? 0;
    const female = dto.femaleCapacity ?? 0;
    const assignedMale = dto.assignedMaleCapacity ?? 0;
    const assignedFemale = dto.assignedFemaleCapacity ?? 0;
    if (assignedMale > male || assignedFemale > female) {
      throw new BadRequestException(
        'ظرفیت اختصاص‌داده‌شده نمی‌تواند از ظرفیت کل بیشتر باشد',
      );
    }
  }

  private async resolveGeo(dto: {
    countryId?: string | null;
    provinceId?: string | null;
    cityId?: string | null;
  }) {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
        include: { province: true },
      });
      if (!city) {
        throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
      }
      return {
        cityId: city.id,
        provinceId: city.provinceId,
        countryId: city.province.countryId,
      };
    }
    if (dto.provinceId) {
      const province = await this.prisma.province.findUnique({
        where: { id: dto.provinceId },
      });
      if (!province) {
        throw new BadRequestException('استان انتخاب‌شده معتبر نیست');
      }
      return {
        cityId: null,
        provinceId: province.id,
        countryId: province.countryId,
      };
    }
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });
      if (!country) {
        throw new BadRequestException('کشور انتخاب‌شده معتبر نیست');
      }
      return { cityId: null, provinceId: null, countryId: country.id };
    }
    return {
      cityId: dto.cityId ?? null,
      provinceId: dto.provinceId ?? null,
      countryId: dto.countryId ?? null,
    };
  }

  private toData(
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    geo: { countryId: string | null; provinceId: string | null; cityId: string | null },
    isUpdate = false,
  ): Prisma.AccommodationUncheckedCreateInput | Prisma.AccommodationUncheckedUpdateInput {
    const decimal = (value: number | null | undefined) => {
      if (value === undefined) return undefined;
      return value == null ? null : new Prisma.Decimal(value);
    };
    const data: Record<string, unknown> = {
      countryId: geo.countryId,
      provinceId: geo.provinceId,
      cityId: geo.cityId,
    };
    const set = (key: string, value: unknown) => {
      if (value !== undefined) {
        data[key] = value;
      }
    };

    set('name', dto.name?.trim());
    set('type', dto.type as AccommodationType | undefined);
    set('status', dto.status as AccommodationStatus | undefined);
    set('genderType', dto.genderType as GenderType | undefined);
    set('maleCapacity', dto.maleCapacity);
    set('femaleCapacity', dto.femaleCapacity);
    set('assignedMaleCapacity', dto.assignedMaleCapacity);
    set('assignedFemaleCapacity', dto.assignedFemaleCapacity);
    set('phone', dto.phone);
    set('address', dto.address);
    set('neshanAddress', dto.neshanAddress);
    set('latitude', decimal(dto.latitude));
    set('longitude', decimal(dto.longitude));
    set('eitaa', dto.eitaa);
    set('bale', dto.bale);
    set('otherSocial', dto.otherSocial);
    set('description', dto.description);
    set('distanceToShrineKm', decimal(dto.distanceToShrineKm));
    set('distanceToMashhadKm', decimal(dto.distanceToMashhadKm));
    set('hasLaundry', dto.hasLaundry);
    set('hasInternet', dto.hasInternet);
    set('hasPrayerRoom', dto.hasPrayerRoom);
    set('hasElevator', dto.hasElevator);
    set('heatingSystem', dto.heatingSystem);
    set('coolingSystem', dto.coolingSystem);
    set('parkingCapacity', dto.parkingCapacity);
    set('bathroomCount', dto.bathroomCount);
    set('toiletCount', dto.toiletCount);

    if (!isUpdate) {
      return {
        ...data,
        name: (dto as CreateAccommodationDto).name.trim(),
        type: (dto as CreateAccommodationDto).type,
        genderType: (dto as CreateAccommodationDto).genderType,
        status: dto.status ?? 'ACTIVE',
      } as Prisma.AccommodationUncheckedCreateInput;
    }

    return data as Prisma.AccommodationUncheckedUpdateInput;
  }

  private async syncManagers(
    tx: Prisma.TransactionClient,
    input: {
      accommodationId: string;
      managerUserIds: string[];
      primaryUserId: string | null;
      actorId: string;
      forcePrimaryIfFirst: boolean;
    },
  ) {
    const uniqueIds = [...new Set(input.managerUserIds)];
    if (input.primaryUserId && !uniqueIds.includes(input.primaryUserId)) {
      uniqueIds.push(input.primaryUserId);
    }

    for (const userId of uniqueIds) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('مدیر اسکان انتخاب‌شده معتبر نیست');
      }
      const role = await tx.role.findUnique({
        where: { code: 'ACCOMMODATION_MANAGER' },
      });
      if (!role) {
        throw new BadRequestException('نقش مدیر اسکان تعریف نشده است');
      }
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id },
      });
    }

    await tx.accommodationManager.deleteMany({
      where: uniqueIds.length
        ? {
            accommodationId: input.accommodationId,
            userId: { notIn: uniqueIds },
          }
        : { accommodationId: input.accommodationId },
    });

    for (const userId of uniqueIds) {
      await tx.accommodationManager.upsert({
        where: {
          accommodationId_userId: {
            accommodationId: input.accommodationId,
            userId,
          },
        },
        update: {},
        create: {
          accommodationId: input.accommodationId,
          userId,
          isPrimary: false,
        },
      });
    }

    if (!uniqueIds.length) {
      return;
    }

    let primaryId = input.primaryUserId;
    if (input.forcePrimaryIfFirst && !primaryId && uniqueIds.length === 1) {
      const existingPrimary = await tx.accommodationManager.findFirst({
        where: { userId: uniqueIds[0], isPrimary: true },
      });
      if (!existingPrimary) {
        primaryId = uniqueIds[0];
      }
    }

    if (primaryId) {
      await this.setUserPrimary(tx, primaryId, input.accommodationId);
    }
  }

  private async setUserPrimary(
    tx: Prisma.TransactionClient,
    userId: string,
    accommodationId: string,
  ) {
    const link = await tx.accommodationManager.findUnique({
      where: { accommodationId_userId: { accommodationId, userId } },
    });
    if (!link) {
      throw new ForbiddenException('این اسکان برای شما ثبت نشده است');
    }
    await tx.accommodationManager.updateMany({
      where: { userId, isPrimary: true, NOT: { accommodationId } },
      data: { isPrimary: false },
    });
    await tx.accommodationManager.update({
      where: { id: link.id },
      data: { isPrimary: true },
    });
  }

  private serialize(item: AccommodationRecord) {
    const num = (value: Prisma.Decimal | null) =>
      value == null ? null : Number(value);
    return {
      ...item,
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      distanceToShrineKm: num(item.distanceToShrineKm),
      distanceToMashhadKm: num(item.distanceToMashhadKm),
    };
  }
}
