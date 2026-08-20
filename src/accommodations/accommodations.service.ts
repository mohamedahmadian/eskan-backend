import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import * as ExcelJS from 'exceljs';
import {
  Prisma,
  type AccommodationStatus,
  type AccommodationType,
  type GenderType,
  type ManagementType,
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
    orderBy: [
      { year: 'desc' as const },
      { isPrimary: 'desc' as const },
      { createdAt: 'asc' as const },
    ],
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
    const where = this.listWhere(query, actor);
    const findMany = {
      where,
      orderBy: { createdAt: 'desc' as const },
      include: accommodationInclude,
    };

    if (!wantsPagination(query)) {
      const items = await this.prisma.accommodation.findMany(findMany);
      return items.map((item) => this.serialize(item));
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({ ...findMany, skip, take }),
      this.prisma.accommodation.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async report(actor: Actor, year?: number) {
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({}, actor);
    const withManagerWhere = this.andWhere(scope, {
      managers: { some: this.assignedManagerYear(selectedYear) },
    });
    const withoutManagerWhere = this.andWhere(scope, {
      managers: { none: this.assignedManagerYear(selectedYear) },
    });
    const activeInYearWhere = this.andWhere(scope, {
      managers: { some: { year: selectedYear } },
    });
    const inactiveInYearWhere = this.andWhere(scope, {
      managers: { none: { year: selectedYear } },
    });
    const [
      total,
      genderRows,
      managementRows,
      comboRows,
      withManager,
      withoutManager,
      activeInYear,
      inactiveInYear,
    ] = await Promise.all([
      this.prisma.accommodation.count({ where: scope }),
      this.prisma.accommodation.groupBy({
        by: ['genderType'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.accommodation.groupBy({
        by: ['managementType'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.accommodation.groupBy({
        by: ['genderType', 'managementType'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.accommodation.count({ where: withManagerWhere }),
      this.prisma.accommodation.count({ where: withoutManagerWhere }),
      this.prisma.accommodation.count({ where: activeInYearWhere }),
      this.prisma.accommodation.count({ where: inactiveInYearWhere }),
    ]);

    const genderCount = new Map(
      genderRows.map((row) => [row.genderType, row._count._all]),
    );
    const managementCount = new Map(
      managementRows.map((row) => [row.managementType, row._count._all]),
    );
    const comboCount = new Map(
      comboRows.map((row) => [
        `${row.genderType}:${row.managementType}`,
        row._count._all,
      ]),
    );

    return {
      year: selectedYear,
      total,
      byManagerStatus: {
        withManager,
        withoutManager,
      },
      byYearActivity: {
        active: activeInYear,
        inactive: inactiveInYear,
      },
      byGenderType: genderTypeOrder.map((genderType) => ({
        genderType,
        count: genderCount.get(genderType) ?? 0,
      })),
      byManagementType: managementTypeOrder.map((managementType) => ({
        managementType,
        count: managementCount.get(managementType) ?? 0,
      })),
      byCombination: genderTypeOrder.flatMap((genderType) =>
        managementTypeOrder.map((managementType) => ({
          genderType,
          managementType,
          count: comboCount.get(`${genderType}:${managementType}`) ?? 0,
        })),
      ),
    };
  }

  async exportExcel(query: FindAccommodationsQueryDto, actor: Actor) {
    const where = this.listWhere(query, actor);
    const items = await this.prisma.accommodation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: accommodationInclude,
    });
    return this.buildExcel(items.map((item) => this.serialize(item)));
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

  async activateYear(
    id: string,
    actor: Actor,
    year?: number,
    copyPreviousManager = false,
  ) {
    const selectedYear = year ?? currentJalaliYear();
    await this.findRecord(id, actor);

    const existing = await this.prisma.accommodationManager.findFirst({
      where: { accommodationId: id, year: selectedYear },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('وضعیت این اسکان برای این سال قبلاً مشخص شده است');
    }

    if (copyPreviousManager) {
      const previousYear = selectedYear - 1;
      const previousManagers = await this.prisma.accommodationManager.findMany({
        where: {
          accommodationId: id,
          year: previousYear,
          userId: { not: null },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });
      const previous = previousManagers[0];
      if (!previous?.userId) {
        throw new BadRequestException('مدیر سال قبل برای این اسکان یافت نشد');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: previous.userId },
        include: { userRoles: { include: { role: { select: { code: true } } } } },
      });
      if (!user || !user.userRoles.some((item) => item.role.code === 'ACCOMMODATION_MANAGER')) {
        throw new BadRequestException('مدیر سال قبل دیگر معتبر نیست');
      }

      const hasPrimaryThisYear = await this.prisma.accommodationManager.findFirst({
        where: { userId: previous.userId, year: selectedYear, isPrimary: true },
        select: { id: true },
      });

      await this.prisma.accommodationManager.create({
        data: {
          accommodationId: id,
          userId: previous.userId,
          year: selectedYear,
          isPrimary: !hasPrimaryThisYear && previous.isPrimary,
        },
      });
      return this.findOne(id, actor);
    }

    await this.prisma.accommodationManager.create({
      data: {
        accommodationId: id,
        userId: null,
        year: selectedYear,
        isPrimary: false,
      },
    });
    return this.findOne(id, actor);
  }

  async assignManager(id: string, userId: string, year: number, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    await this.findRecord(id, actor);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: { select: { code: true } } } } },
    });
    if (!user || !user.userRoles.some((item) => item.role.code === 'ACCOMMODATION_MANAGER')) {
      throw new BadRequestException('مدیر اسکان انتخاب‌شده معتبر نیست');
    }

    const existing = await this.prisma.accommodationManager.findUnique({
      where: {
        userId_accommodationId_year: { userId, accommodationId: id, year },
      },
    });
    if (existing) {
      throw new ConflictException('این مدیر برای این سال قبلاً به این اسکان تخصیص داده شده است');
    }

    const hasPrimaryThisYear = await this.prisma.accommodationManager.findFirst({
      where: { userId, year, isPrimary: true },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.removeUnassignedYear(tx, id, year);
      await tx.accommodationManager.create({
        data: {
          userId,
          accommodationId: id,
          year,
          isPrimary: !hasPrimaryThisYear,
        },
      });
    });
    return this.findOne(id, actor);
  }

  async unassignManager(id: string, assignmentId: string, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    await this.findRecord(id, actor);
    const link = await this.prisma.accommodationManager.findFirst({
      where: { id: assignmentId, accommodationId: id },
    });
    if (!link) {
      throw new NotFoundException('این تخصیص یافت نشد');
    }
    await this.prisma.accommodationManager.delete({ where: { id: assignmentId } });
    return this.findOne(id, actor);
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

  private andWhere(
    base: Prisma.AccommodationWhereInput,
    extra: Prisma.AccommodationWhereInput,
  ): Prisma.AccommodationWhereInput {
    if (!Object.keys(base).length) {
      return extra;
    }
    return { AND: [base, extra] };
  }

  private listWhere(
    query: FindAccommodationsQueryDto,
    actor: Actor,
  ): Prisma.AccommodationWhereInput {
    const filters: Prisma.AccommodationWhereInput[] = [];
    if (!isAdmin(actor)) {
      filters.push({ managers: { some: { userId: actor.id } } });
    }
    if (query.managementType) {
      filters.push({ managementType: query.managementType });
    }
    if (query.genderType) {
      filters.push({ genderType: query.genderType });
    }
    if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    }
    if (query.year) {
      filters.push({ managers: { some: { year: query.year } } });
    }
    if (query.hasManagerThisYear !== undefined) {
      const year = currentJalaliYear();
      filters.push(
        query.hasManagerThisYear
          ? { managers: { some: this.assignedManagerYear(year) } }
          : { managers: { none: this.assignedManagerYear(year) } },
      );
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

  private assignedManagerYear(year: number): Prisma.AccommodationManagerWhereInput {
    return { year, userId: { not: null } };
  }

  private async removeUnassignedYear(
    tx: Prisma.TransactionClient,
    accommodationId: string,
    year: number,
  ) {
    await tx.accommodationManager.deleteMany({
      where: { accommodationId, year, userId: null },
    });
  }

  private canAccess(item: { managers: { userId: string | null }[] }, actor: Actor) {
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
    set('managementType', dto.managementType as ManagementType | undefined);
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
        managementType:
          (dto as CreateAccommodationDto).managementType ?? 'SELF_SUFFICIENT',
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
    const year = currentJalaliYear();
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
            year,
            OR: [{ userId: { notIn: uniqueIds } }, { userId: null }],
          }
        : { accommodationId: input.accommodationId, year },
    });

    for (const userId of uniqueIds) {
      await tx.accommodationManager.upsert({
        where: {
          userId_accommodationId_year: {
            userId,
            accommodationId: input.accommodationId,
            year,
          },
        },
        update: {},
        create: {
          accommodationId: input.accommodationId,
          userId,
          year,
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
        where: { userId: uniqueIds[0], year, isPrimary: true },
      });
      if (!existingPrimary) {
        primaryId = uniqueIds[0];
      }
    }

    if (primaryId) {
      await this.setUserPrimary(tx, primaryId, input.accommodationId, year);
    }
  }

  private async setUserPrimary(
    tx: Prisma.TransactionClient,
    userId: string,
    accommodationId: string,
    year = currentJalaliYear(),
  ) {
    const link = await tx.accommodationManager.findUnique({
      where: {
        userId_accommodationId_year: { userId, accommodationId, year },
      },
    });
    if (!link) {
      throw new ForbiddenException('این اسکان برای شما ثبت نشده است');
    }
    await tx.accommodationManager.updateMany({
      where: { userId, year, isPrimary: true, NOT: { accommodationId } },
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

  private async buildExcel(items: ReturnType<AccommodationsService['serialize']>[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'اسکان';
    const sheet = workbook.addWorksheet('اسکان‌ها', {
      views: [{ rightToLeft: true }],
    });

    const amenity = (value: boolean) => (value ? 'دارد' : 'ندارد');
    const geoName = (item: { nameFa: string } | null) => item?.nameFa ?? '';

    sheet.columns = [
      { header: 'نام محل اسکان', key: 'name', width: 28 },
      { header: 'نوع اسکان', key: 'type', width: 14 },
      { header: 'نوع مدیریت', key: 'managementType', width: 16 },
      { header: 'نوع پذیرش', key: 'genderType', width: 14 },
      { header: 'وضعیت', key: 'status', width: 16 },
      { header: 'کشور', key: 'country', width: 14 },
      { header: 'استان', key: 'province', width: 16 },
      { header: 'شهر', key: 'city', width: 16 },
      { header: 'تلفن', key: 'phone', width: 16 },
      { header: 'آدرس', key: 'address', width: 36 },
      { header: 'ظرفیت آقایان', key: 'maleCapacity', width: 14 },
      { header: 'ظرفیت خانم‌ها', key: 'femaleCapacity', width: 14 },
      { header: 'ظرفیت اختصاص‌داده‌شده مرد', key: 'assignedMaleCapacity', width: 22 },
      { header: 'ظرفیت اختصاص‌داده‌شده زن', key: 'assignedFemaleCapacity', width: 22 },
      { header: 'فاصله تا حرم (کیلومتر)', key: 'distanceToShrineKm', width: 20 },
      { header: 'فاصله تا مشهد (کیلومتر)', key: 'distanceToMashhadKm', width: 20 },
      { header: 'لباسشویی', key: 'hasLaundry', width: 12 },
      { header: 'اینترنت', key: 'hasInternet', width: 12 },
      { header: 'نمازخانه', key: 'hasPrayerRoom', width: 12 },
      { header: 'آسانسور', key: 'hasElevator', width: 12 },
      { header: 'سیستم گرمایش', key: 'heatingSystem', width: 18 },
      { header: 'سیستم سرمایش', key: 'coolingSystem', width: 18 },
      { header: 'ظرفیت پارکینگ', key: 'parkingCapacity', width: 16 },
      { header: 'تعداد حمام', key: 'bathroomCount', width: 12 },
      { header: 'تعداد سرویس بهداشتی', key: 'toiletCount', width: 18 },
      { header: 'مدیران', key: 'managers', width: 28 },
      { header: 'توضیحات', key: 'description', width: 32 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    for (const item of items) {
      sheet.addRow({
        name: item.name,
        type: accommodationTypeLabels[item.type],
        managementType: managementTypeLabels[item.managementType],
        genderType: genderTypeLabels[item.genderType],
        status: accommodationStatusLabels[item.status],
        country: geoName(item.country),
        province: geoName(item.province),
        city: geoName(item.city),
        phone: item.phone ?? '',
        address: item.address ?? '',
        maleCapacity: item.maleCapacity,
        femaleCapacity: item.femaleCapacity,
        assignedMaleCapacity: item.assignedMaleCapacity,
        assignedFemaleCapacity: item.assignedFemaleCapacity,
        distanceToShrineKm: item.distanceToShrineKm,
        distanceToMashhadKm: item.distanceToMashhadKm,
        hasLaundry: amenity(item.hasLaundry),
        hasInternet: amenity(item.hasInternet),
        hasPrayerRoom: amenity(item.hasPrayerRoom),
        hasElevator: amenity(item.hasElevator),
        heatingSystem: item.heatingSystem ?? '',
        coolingSystem: item.coolingSystem ?? '',
        parkingCapacity: item.parkingCapacity,
        bathroomCount: item.bathroomCount,
        toiletCount: item.toiletCount,
        managers: item.managers
          .map((manager) => {
            const primary = manager.isPrimary ? ' (اصلی)' : '';
            const name = manager.user?.fullName ?? 'بدون مدیر';
            return `${name}${primary} — ${manager.year}`;
          })
          .join('، '),
        description: item.description ?? '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

const accommodationTypeLabels: Record<AccommodationType, string> = {
  SCHOOL: 'مدرسه',
  MOSQUE: 'مسجد',
  HUSSEINIEH: 'حسینیه',
  HALL: 'سالن',
  HOUSE: 'منزل',
  OTHER: 'سایر',
};

const accommodationStatusLabels: Record<AccommodationStatus, string> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  FULL: 'تکمیل ظرفیت',
};

const genderTypeOrder: GenderType[] = ['FEMALE', 'MALE', 'MIXED'];
const managementTypeOrder: ManagementType[] = [
  'SELF_SUFFICIENT',
  'SEMI_SELF_SUFFICIENT',
  'NON_SELF_SUFFICIENT',
];

const genderTypeLabels: Record<GenderType, string> = {
  MALE: 'آقایان',
  FEMALE: 'خانم‌ها',
  MIXED: 'مختلط',
};

const managementTypeLabels: Record<ManagementType, string> = {
  SELF_SUFFICIENT: 'خودکفا',
  SEMI_SELF_SUFFICIENT: 'نیمه خودکفا',
  NON_SELF_SUFFICIENT: 'غیرخودکفا',
};
