import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import {
  Prisma,
  AccommodationStatus,
  type AccommodationContactRole,
  type AccommodationType,
  type GenderType,
  type ManagementType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { FindYearManagementQueryDto } from './dto/find-year-management-query.dto';
import {
  SetAccommodationYearContactsDto,
  type YearContactMode,
} from './dto/set-accommodation-year-contacts.dto';
import { TransferAccommodationsYearDto } from './dto/transfer-accommodations-year.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { resolveSortOrder } from '../common/sort-query';
import { effectiveCapacity } from '../placements/placement-capacity';
import type { AccommodationContactInputDto } from './dto/accommodation-contact-input.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const contactUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  nationalId: true,
  phone: true,
  birthDate: true,
  status: true,
} as const;

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
  contacts: {
    orderBy: { role: 'asc' as const },
    select: {
      id: true,
      role: true,
      userId: true,
      user: { select: contactUserSelect },
    },
  },
  yearContacts: {
    orderBy: [{ year: 'desc' as const }, { role: 'asc' as const }],
    select: {
      id: true,
      role: true,
      userId: true,
      year: true,
      user: { select: contactUserSelect },
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findMine(query: FindAccommodationsQueryDto, actor: Actor) {
    const mineWhere = this.listWhere(query, {
      id: actor.id,
      userRoles: [],
    });
    const findMany = {
      where: mineWhere,
      orderBy: this.listOrderBy(query),
      include: accommodationInclude,
    };

    if (!wantsPagination(query)) {
      const items = await this.prisma.accommodation.findMany(findMany);
      return items.map((item) => this.serialize(item));
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({ ...findMany, skip, take }),
      this.prisma.accommodation.count({ where: mineWhere }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findAll(query: FindAccommodationsQueryDto, actor: Actor) {
    const where = this.listWhere(query, actor);
    const findMany = {
      where,
      orderBy: this.listOrderBy(query),
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
      typeRows,
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
        by: ['type'],
        where: scope,
        _count: { _all: true },
      }),
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

    const typeCount = new Map(typeRows.map((row) => [row.type, row._count._all]));
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
      byType: accommodationTypeOrder.map((type) => ({
        type,
        count: typeCount.get(type) ?? 0,
      })),
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
      orderBy: this.listOrderBy(query),
      include: accommodationInclude,
    });
    return this.buildExcel(items.map((item) => this.serialize(item)));
  }

  async findPublicOne(id: string) {
    const item = await this.prisma.accommodation.findFirst({
      where: { id, status: { not: AccommodationStatus.INACTIVE } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        genderType: true,
        managementType: true,
        maleCapacity: true,
        femaleCapacity: true,
        phone: true,
        address: true,
        neshanAddress: true,
        latitude: true,
        longitude: true,
        eitaa: true,
        bale: true,
        otherSocial: true,
        description: true,
        country: { select: geoSelect },
        province: { select: { ...geoSelect, countryId: true } },
        city: { select: { ...geoSelect, provinceId: true } },
        distanceToShrineKm: true,
        distanceToMashhadKm: true,
        hasLaundry: true,
        hasInternet: true,
        hasPrayerRoom: true,
        hasElevator: true,
        heatingSystem: true,
        coolingSystem: true,
        parkingCapacity: true,
        bathroomCount: true,
        toiletCount: true,
      },
    });
    if (!item) {
      throw new NotFoundException('اسکان یافت نشد');
    }
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
    this.assertCapacity({
      maleCapacity: dto.maleCapacity,
      femaleCapacity: dto.femaleCapacity,
      overflowPercent: dto.overflowPercent,
      assignedMaleCapacity: 0,
      assignedFemaleCapacity: 0,
    });
    const geo = await this.resolveGeo(dto);
    const admin = isAdmin(actor);
    if (!admin) {
      await this.users.ensureRole(actor.id, 'ACCOMMODATION_MANAGER');
    }
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
        year: dto.year,
        maleCapacity: dto.maleCapacity ?? 0,
        femaleCapacity: dto.femaleCapacity ?? 0,
      });
      return row;
    });

    if (dto.contacts) {
      await this.syncContacts(created.id, dto.contacts);
    }

    if (!admin) {
      await this.applyYearContacts(
        created.id,
        currentJalaliYear(),
        dto.yearContactMode ?? 'manager',
        dto.contacts,
        actor.id,
      );
    }

    return this.findOne(created.id, actor);
  }

  async update(id: string, dto: UpdateAccommodationDto, actor: Actor) {
    const current = await this.findRecord(id, actor);
    const nextMale = dto.maleCapacity ?? current.maleCapacity;
    const nextFemale = dto.femaleCapacity ?? current.femaleCapacity;
    this.assertCapacity({
      maleCapacity: nextMale,
      femaleCapacity: nextFemale,
      overflowPercent: dto.overflowPercent ?? current.overflowPercent,
      assignedMaleCapacity: current.assignedMaleCapacity,
      assignedFemaleCapacity: current.assignedFemaleCapacity,
    });
    const geo = await this.resolveGeo({
      countryId: dto.countryId === undefined ? current.countryId : dto.countryId,
      provinceId:
        dto.provinceId === undefined ? current.provinceId : dto.provinceId,
      cityId: dto.cityId === undefined ? current.cityId : dto.cityId,
    });
    const admin = isAdmin(actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.accommodation.update({
        where: { id },
        data: this.toData(dto, geo, true) as Prisma.AccommodationUncheckedUpdateInput,
      });
      if (dto.maleCapacity !== undefined || dto.femaleCapacity !== undefined) {
        await this.syncYearCapacities(
          tx,
          id,
          currentJalaliYear(),
          nextMale,
          nextFemale,
        );
      }
      if (admin && (dto.managerUserIds || dto.primaryManagerUserId !== undefined)) {
        const managerIds = dto.managerUserIds
          ? [...new Set(dto.managerUserIds)]
          : current.managers
              .map((item) => item.userId)
              .filter((userId): userId is string => Boolean(userId));
        await this.syncManagers(tx, {
          accommodationId: id,
          managerUserIds: managerIds,
          primaryUserId:
            dto.primaryManagerUserId === undefined
              ? (current.managers.find((item) => item.isPrimary)?.userId ?? null)
              : dto.primaryManagerUserId,
          actorId: actor.id,
          forcePrimaryIfFirst: false,
          maleCapacity: nextMale,
          femaleCapacity: nextFemale,
        });
      } else if (!admin && dto.isPrimary === true) {
        await this.setUserPrimary(tx, actor.id, id);
      }
    });

    if (dto.contacts !== undefined) {
      await this.syncContacts(id, dto.contacts ?? []);
    }

    return this.findOne(id, actor);
  }

  async setYearContacts(
    id: string,
    dto: SetAccommodationYearContactsDto,
    actor: Actor,
  ) {
    await this.findRecord(id, actor);
    const year = dto.year ?? currentJalaliYear();
    await this.applyYearContacts(
      id,
      year,
      dto.mode,
      dto.contacts,
      actor.id,
    );
    return this.findOne(id, actor);
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
    const current = await this.findRecord(id, actor);

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
          maleCapacity: previous.maleCapacity,
          femaleCapacity: previous.femaleCapacity,
        },
      });
      await this.copyYearContactsBetweenYears(id, previousYear, selectedYear);
      return this.findOne(id, actor);
    }

    await this.prisma.accommodationManager.create({
      data: {
        accommodationId: id,
        userId: null,
        year: selectedYear,
        isPrimary: false,
        maleCapacity: current.maleCapacity,
        femaleCapacity: current.femaleCapacity,
      },
    });
    return this.findOne(id, actor);
  }

  async assignManager(
    id: string,
    userId: string | null,
    year: number,
    actor: Actor,
    capacities?: { maleCapacity?: number; femaleCapacity?: number },
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const hasCapacityInput =
      capacities?.maleCapacity !== undefined || capacities?.femaleCapacity !== undefined;
    if (!userId && !hasCapacityInput) {
      return this.activateYear(id, actor, year, false);
    }
    const current = await this.findRecord(id, actor);

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: { select: { code: true } } } } },
      });
      if (!user || !user.userRoles.some((item) => item.role.code === 'ACCOMMODATION_MANAGER')) {
        throw new BadRequestException('مدیر اسکان انتخاب‌شده معتبر نیست');
      }
    }

    const existingYear = await this.prisma.accommodationManager.findFirst({
      where: { accommodationId: id, year },
      select: { id: true, maleCapacity: true, femaleCapacity: true },
    });
    const existingAssignment = userId
      ? await this.prisma.accommodationManager.findUnique({
          where: {
            userId_accommodationId_year: { userId, accommodationId: id, year },
          },
        })
      : null;
    if (existingAssignment && !hasCapacityInput) {
      throw new ConflictException('این مدیر برای این سال قبلاً به این اسکان تخصیص داده شده است');
    }

    const nextCaps = {
      maleCapacity:
        capacities?.maleCapacity ?? existingYear?.maleCapacity ?? current.maleCapacity,
      femaleCapacity:
        capacities?.femaleCapacity ?? existingYear?.femaleCapacity ?? current.femaleCapacity,
    };

    await this.prisma.$transaction(async (tx) => {
      if (userId && !existingAssignment) {
        const hasPrimaryThisYear = await tx.accommodationManager.findFirst({
          where: { userId, year, isPrimary: true },
          select: { id: true },
        });
        await this.removeUnassignedYear(tx, id, year);
        await tx.accommodationManager.create({
          data: {
            userId,
            accommodationId: id,
            year,
            isPrimary: !hasPrimaryThisYear,
            ...nextCaps,
          },
        });
      } else if (!userId && !existingYear) {
        await tx.accommodationManager.create({
          data: {
            userId: null,
            accommodationId: id,
            year,
            isPrimary: false,
            ...nextCaps,
          },
        });
      }
      await this.syncYearCapacities(
        tx,
        id,
        year,
        nextCaps.maleCapacity,
        nextCaps.femaleCapacity,
      );
      if (year === currentJalaliYear() && hasCapacityInput) {
        this.assertCapacity({
          maleCapacity: nextCaps.maleCapacity,
          femaleCapacity: nextCaps.femaleCapacity,
          overflowPercent: current.overflowPercent,
          assignedMaleCapacity: current.assignedMaleCapacity,
          assignedFemaleCapacity: current.assignedFemaleCapacity,
        });
        await tx.accommodation.update({
          where: { id },
          data: {
            maleCapacity: nextCaps.maleCapacity,
            femaleCapacity: nextCaps.femaleCapacity,
          },
        });
      }
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

  async yearStats(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({}, actor);
    const [total, active, inactive] = await Promise.all([
      this.prisma.accommodation.count({ where: scope }),
      this.prisma.accommodation.count({
        where: this.andWhere(scope, { managers: { some: { year: selectedYear } } }),
      }),
      this.prisma.accommodation.count({
        where: this.andWhere(scope, { managers: { none: { year: selectedYear } } }),
      }),
    ]);
    return { year: selectedYear, total, active, inactive };
  }

  async findActiveInYear(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    return this.findYearList({ ...query, yearActivity: 'active' }, actor);
  }

  async findYearList(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const activity = query.yearActivity ?? 'all';
    const base = this.listWhere({ q: query.q }, actor);
    const yearFilter: Prisma.AccommodationWhereInput =
      activity === 'active'
        ? { managers: { some: { year: query.year } } }
        : activity === 'inactive'
          ? { managers: { none: { year: query.year } } }
          : {};
    const where = this.andWhere(base, yearFilter);
    const findMany = {
      where,
      orderBy: this.listOrderBy({
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      }),
      include: accommodationInclude,
    };

    const withFlag = (item: AccommodationRecord) => ({
      ...this.serialize(item),
      activeInYear: item.managers.some((row) => row.year === query.year),
    });

    if (!wantsPagination(query)) {
      const items = await this.prisma.accommodation.findMany(findMany);
      return items.map(withFlag);
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({ ...findMany, skip, take }),
      this.prisma.accommodation.count({ where }),
    ]);
    return paginatedResult(items.map(withFlag), total, page, pageSize);
  }

  async findInactiveInYear(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const where = this.andWhere(this.listWhere({ q: query.q }, actor), {
      managers: { none: { year: query.year } },
    });
    const items = await this.prisma.accommodation.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, type: true, city: { select: geoSelect } },
    });
    return items;
  }

  async addToYear(accommodationId: string, actor: Actor, year?: number) {
    this.assertAdmin(actor);
    return this.activateYear(accommodationId, actor, year, false);
  }

  async activateAllInactive(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({}, actor);
    const inactive = await this.prisma.accommodation.findMany({
      where: this.andWhere(scope, {
        managers: { none: { year: selectedYear } },
      }),
      select: { id: true, maleCapacity: true, femaleCapacity: true },
    });
    if (!inactive.length) {
      return { year: selectedYear, activated: 0 };
    }

    await this.prisma.accommodationManager.createMany({
      data: inactive.map((item) => ({
        accommodationId: item.id,
        userId: null,
        year: selectedYear,
        isPrimary: false,
        maleCapacity: item.maleCapacity,
        femaleCapacity: item.femaleCapacity,
      })),
    });

    return { year: selectedYear, activated: inactive.length };
  }

  async deactivateAllActive(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({}, actor);
    const active = await this.prisma.accommodation.findMany({
      where: this.andWhere(scope, {
        managers: { some: { year: selectedYear } },
      }),
      select: { id: true },
    });
    if (!active.length) {
      return { year: selectedYear, removed: 0 };
    }

    const result = await this.prisma.accommodationManager.deleteMany({
      where: {
        year: selectedYear,
        accommodationId: { in: active.map((item) => item.id) },
      },
    });

    return { year: selectedYear, removed: result.count, accommodations: active.length };
  }

  async removeFromYear(accommodationId: string, actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    await this.findRecord(accommodationId, actor);
    const result = await this.prisma.accommodationManager.deleteMany({
      where: { accommodationId, year: selectedYear },
    });
    if (result.count === 0) {
      throw new NotFoundException('این اسکان در سال انتخاب‌شده فعال نیست');
    }
    return { ok: true, year: selectedYear, removed: result.count };
  }

  async transferYears(dto: TransferAccommodationsYearDto, actor: Actor) {
    this.assertAdmin(actor);
    const sourceYear = dto.sourceYear;
    const targetYear = dto.targetYear ?? currentJalaliYear();
    if (sourceYear === targetYear) {
      throw new BadRequestException('سال مبدأ و مقصد نباید یکسان باشند');
    }

    const copyManagers = dto.copyManagers !== false;
    const copyYearContacts = dto.copyYearContacts !== false;
    const scope = this.listWhere({}, actor);
    const activeInSource = this.andWhere(scope, {
      managers: { some: { year: sourceYear } },
    });

    let candidates: { id: string }[];
    if (dto.all) {
      candidates = await this.prisma.accommodation.findMany({
        where: activeInSource,
        select: { id: true },
      });
    } else {
      const ids = [...new Set(dto.accommodationIds ?? [])];
      if (!ids.length) {
        throw new BadRequestException('حداقل یک اسکان برای انتقال انتخاب کنید');
      }
      candidates = await this.prisma.accommodation.findMany({
        where: this.andWhere(activeInSource, { id: { in: ids } }),
        select: { id: true },
      });
      if (candidates.length !== ids.length) {
        throw new BadRequestException(
          'برخی اسکان‌های انتخاب‌شده در سال مبدأ فعال نیستند',
        );
      }
    }

    let transferred = 0;
    let skipped = 0;
    const errors: { accommodationId: string; message: string }[] = [];

    for (const { id } of candidates) {
      try {
        const result = await this.transferOneToYear(
          id,
          sourceYear,
          targetYear,
          copyManagers,
          copyYearContacts,
        );
        if (result === 'skipped') skipped += 1;
        else transferred += 1;
      } catch (error) {
        skipped += 1;
        const message =
          error instanceof BadRequestException ||
          error instanceof ConflictException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
            ? String(error.message)
            : error instanceof Error
              ? error.message
              : 'خطا در انتقال اسکان';
        errors.push({ accommodationId: id, message });
      }
    }

    return {
      sourceYear,
      targetYear,
      copyManagers,
      copyYearContacts,
      requested: candidates.length,
      transferred,
      skipped,
      errors,
    };
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
  }

  private async transferOneToYear(
    accommodationId: string,
    sourceYear: number,
    targetYear: number,
    copyManagers: boolean,
    copyYearContacts: boolean,
  ): Promise<'ok' | 'skipped'> {
    const existing = await this.prisma.accommodationManager.findFirst({
      where: { accommodationId, year: targetYear },
      select: { id: true },
    });
    if (existing) {
      return 'skipped';
    }

    const sourceYearRow = await this.prisma.accommodationManager.findFirst({
      where: { accommodationId, year: sourceYear },
      select: { maleCapacity: true, femaleCapacity: true },
    });
    const accommodation = sourceYearRow
      ? null
      : await this.prisma.accommodation.findUnique({
          where: { id: accommodationId },
          select: { maleCapacity: true, femaleCapacity: true },
        });
    const yearCaps = {
      maleCapacity: sourceYearRow?.maleCapacity ?? accommodation?.maleCapacity ?? 0,
      femaleCapacity: sourceYearRow?.femaleCapacity ?? accommodation?.femaleCapacity ?? 0,
    };

    if (!copyManagers) {
      await this.prisma.accommodationManager.create({
        data: {
          accommodationId,
          userId: null,
          year: targetYear,
          isPrimary: false,
          ...yearCaps,
        },
      });
      if (copyYearContacts) {
        await this.copyYearContactsBetweenYears(
          accommodationId,
          sourceYear,
          targetYear,
        );
      }
      return 'ok';
    }

    const sourceManagers = await this.prisma.accommodationManager.findMany({
      where: {
        accommodationId,
        year: sourceYear,
        userId: { not: null },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (!sourceManagers.length) {
      await this.prisma.accommodationManager.create({
        data: {
          accommodationId,
          userId: null,
          year: targetYear,
          isPrimary: false,
          ...yearCaps,
        },
      });
      if (copyYearContacts) {
        await this.copyYearContactsBetweenYears(
          accommodationId,
          sourceYear,
          targetYear,
        );
      }
      return 'ok';
    }

    await this.prisma.$transaction(async (tx) => {
      for (const manager of sourceManagers) {
        if (!manager.userId) continue;
        const user = await tx.user.findUnique({
          where: { id: manager.userId },
          include: {
            userRoles: { include: { role: { select: { code: true } } } },
          },
        });
        if (
          !user ||
          !user.userRoles.some((item) => item.role.code === 'ACCOMMODATION_MANAGER')
        ) {
          continue;
        }

        const already = await tx.accommodationManager.findUnique({
          where: {
            userId_accommodationId_year: {
              userId: manager.userId,
              accommodationId,
              year: targetYear,
            },
          },
        });
        if (already) continue;

        const hasPrimaryThisYear = await tx.accommodationManager.findFirst({
          where: {
            userId: manager.userId,
            year: targetYear,
            isPrimary: true,
          },
          select: { id: true },
        });

        await tx.accommodationManager.create({
          data: {
            accommodationId,
            userId: manager.userId,
            year: targetYear,
            isPrimary: !hasPrimaryThisYear && manager.isPrimary,
            maleCapacity: manager.maleCapacity,
            femaleCapacity: manager.femaleCapacity,
          },
        });
      }

      const created = await tx.accommodationManager.findFirst({
        where: { accommodationId, year: targetYear },
        select: { id: true },
      });
      if (!created) {
        await tx.accommodationManager.create({
          data: {
            accommodationId,
            userId: null,
            year: targetYear,
            isPrimary: false,
            ...yearCaps,
          },
        });
      }
    });

    if (copyYearContacts) {
      await this.copyYearContactsBetweenYears(
        accommodationId,
        sourceYear,
        targetYear,
      );
    }

    return 'ok';
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

  private listOrderBy(
    query: FindAccommodationsQueryDto,
  ): Prisma.AccommodationOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.AccommodationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        type: (dir) => ({ type: dir }),
        managementType: (dir) => ({ managementType: dir }),
        genderType: (dir) => ({ genderType: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: FindAccommodationsQueryDto,
    actor: Actor,
  ): Prisma.AccommodationWhereInput {
    const filters: Prisma.AccommodationWhereInput[] = [];
    if (!isAdmin(actor)) {
      filters.push({ managers: { some: { userId: actor.id } } });
    }
    if (query.type) {
      filters.push({ type: query.type });
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
    overflowPercent?: number;
    assignedMaleCapacity?: number;
    assignedFemaleCapacity?: number;
  }) {
    const male = dto.maleCapacity ?? 0;
    const female = dto.femaleCapacity ?? 0;
    const overflow = dto.overflowPercent ?? 10;
    const assignedMale = dto.assignedMaleCapacity ?? 0;
    const assignedFemale = dto.assignedFemaleCapacity ?? 0;
    if (
      assignedMale > effectiveCapacity(male, overflow) ||
      assignedFemale > effectiveCapacity(female, overflow)
    ) {
      throw new BadRequestException(
        'ظرفیت اختصاص‌داده‌شده نمی‌تواند از گنجایش مؤثر بیشتر باشد',
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
    set('overflowPercent', dto.overflowPercent);
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

  private async syncContacts(
    accommodationId: string,
    contacts: AccommodationContactInputDto[],
  ) {
    if (!contacts.length) {
      await this.prisma.accommodationContact.deleteMany({
        where: { accommodationId },
      });
      return;
    }

    const roles = contacts.map((item) => item.role);
    await this.prisma.accommodationContact.deleteMany({
      where: {
        accommodationId,
        role: { notIn: roles },
      },
    });

    for (const contact of contacts) {
      const { user } = await this.users.findOrCreatePilgrim({
        firstName: contact.firstName,
        lastName: contact.lastName,
        nationalId: contact.nationalId,
        phone: contact.phone,
        birthDate: contact.birthDate ?? null,
      });

      await this.prisma.accommodationContact.upsert({
        where: {
          accommodationId_role: {
            accommodationId,
            role: contact.role,
          },
        },
        create: {
          accommodationId,
          role: contact.role,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }
  }

  private async applyYearContacts(
    accommodationId: string,
    year: number,
    mode: YearContactMode,
    manualContacts: AccommodationContactInputDto[] | undefined,
    fallbackManagerUserId: string,
  ) {
    if (mode === 'manager') {
      const manager = await this.prisma.accommodationManager.findFirst({
        where: {
          accommodationId,
          year,
          userId: { not: null },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { userId: true },
      });
      const userId = manager?.userId ?? fallbackManagerUserId;
      await this.replaceYearContactsWithUser(accommodationId, year, userId);
      return;
    }

    if (mode === 'fromAccommodation') {
      const template = await this.prisma.accommodationContact.findMany({
        where: { accommodationId },
      });
      await this.prisma.accommodationYearContact.deleteMany({
        where: { accommodationId, year },
      });
      for (const contact of template) {
        await this.prisma.accommodationYearContact.create({
          data: {
            accommodationId,
            year,
            role: contact.role,
            userId: contact.userId,
          },
        });
      }
      return;
    }

    // manual
    await this.prisma.accommodationYearContact.deleteMany({
      where: { accommodationId, year },
    });
    for (const contact of manualContacts ?? []) {
      const { user } = await this.users.findOrCreatePilgrim({
        firstName: contact.firstName,
        lastName: contact.lastName,
        nationalId: contact.nationalId,
        phone: contact.phone,
        birthDate: contact.birthDate ?? null,
      });
      await this.prisma.accommodationYearContact.create({
        data: {
          accommodationId,
          year,
          role: contact.role,
          userId: user.id,
        },
      });
    }
  }

  private async replaceYearContactsWithUser(
    accommodationId: string,
    year: number,
    userId: string,
  ) {
    const roles: AccommodationContactRole[] = [
      'DEPUTY',
      'RECEPTION',
      'FACILITIES_SAFETY',
      'SECURITY',
      'HEALTH',
      'CULTURAL',
      'LOGISTICS_SUPPORT',
    ];
    await this.prisma.accommodationYearContact.deleteMany({
      where: { accommodationId, year },
    });
    await this.prisma.accommodationYearContact.createMany({
      data: roles.map((role) => ({
        accommodationId,
        year,
        role,
        userId,
      })),
    });
  }

  private async copyYearContactsBetweenYears(
    accommodationId: string,
    sourceYear: number,
    targetYear: number,
  ) {
    const source = await this.prisma.accommodationYearContact.findMany({
      where: { accommodationId, year: sourceYear },
    });
    if (!source.length) return;

    await this.prisma.accommodationYearContact.deleteMany({
      where: { accommodationId, year: targetYear },
    });
    await this.prisma.accommodationYearContact.createMany({
      data: source.map((item) => ({
        accommodationId,
        year: targetYear,
        role: item.role,
        userId: item.userId,
      })),
    });
  }

  private async syncManagers(
    tx: Prisma.TransactionClient,
    input: {
      accommodationId: string;
      managerUserIds: string[];
      primaryUserId: string | null;
      actorId: string;
      forcePrimaryIfFirst: boolean;
      year?: number;
      maleCapacity?: number;
      femaleCapacity?: number;
    },
  ) {
    const year = input.year ?? currentJalaliYear();
    const yearCaps = {
      maleCapacity: input.maleCapacity ?? 0,
      femaleCapacity: input.femaleCapacity ?? 0,
    };
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
        update: { ...yearCaps },
        create: {
          accommodationId: input.accommodationId,
          userId,
          year,
          isPrimary: false,
          ...yearCaps,
        },
      });
    }

    if (!uniqueIds.length) {
      await tx.accommodationManager.create({
        data: {
          accommodationId: input.accommodationId,
          userId: null,
          year,
          isPrimary: false,
          ...yearCaps,
        },
      });
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

  private async syncYearCapacities(
    tx: Prisma.TransactionClient,
    accommodationId: string,
    year: number,
    maleCapacity: number,
    femaleCapacity: number,
  ) {
    await tx.accommodationManager.updateMany({
      where: { accommodationId, year },
      data: { maleCapacity, femaleCapacity },
    });
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
    const amenity = (value: boolean) => (value ? 'دارد' : 'ندارد');
    const geoName = (item: { nameFa: string } | null) => item?.nameFa ?? '';

    return buildStyledExcelExport({
      sheetName: 'اسکان‌ها',
      columns: [
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
        { header: 'درصد مازاد', key: 'overflowPercent', width: 12 },
        {
          header: 'ظرفیت اختصاص‌شده مرد',
          key: 'assignedMaleCapacity',
          width: 22,
        },
        {
          header: 'ظرفیت اختصاص‌شده خانم',
          key: 'assignedFemaleCapacity',
          width: 22,
        },
        { header: 'فاصله تا حرم (کیلومتر)', key: 'distanceToShrineKm', width: 20 },
        {
          header: 'فاصله تا مشهد (کیلومتر)',
          key: 'distanceToMashhadKm',
          width: 20,
        },
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
      ],
      rows: items.map((item) => ({
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
        overflowPercent: item.overflowPercent,
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
      })),
    });
  }
}

const accommodationTypeOrder: AccommodationType[] = [
  'SCHOOL',
  'MOSQUE',
  'HUSSEINIEH',
  'HALL',
  'HOUSE',
  'OTHER',
];

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
