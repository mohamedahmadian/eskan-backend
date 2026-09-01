import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isAdmin, type RoleBearer } from '../auth/roles.util';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { CaravanContactRole, Prisma, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { joinFullName } from '../users/user-profile.util';
import { UsersService } from '../users/users.service';
import {
  cityLookupKeys,
  normalizeCaravanNameKey,
  normalizeCityLookupKey,
  parseCaravanImportExcel,
  type CaravanImportIssueRow,
  type CaravanImportRow,
  type ParsedCaravanImport,
} from './caravan-excel-import.util';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravanHistoryQueryDto } from './dto/find-caravan-history-query.dto';
import { FindCaravansQueryDto } from './dto/find-caravans-query.dto';
import { FindYearManagementQueryDto } from './dto/find-year-management-query.dto';
import { TransferCaravansYearDto } from './dto/transfer-caravans-year.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';

type Actor = RoleBearer & { id: string };

const caravanGenderKinds = ['FEMALE', 'MALE', 'MIXED', 'UNSPECIFIED'] as const;
type CaravanGenderKind = (typeof caravanGenderKinds)[number];

const caravanOrigins = ['IRANIAN', 'INTERNATIONAL'] as const;
type CaravanOrigin = (typeof caravanOrigins)[number];

const caravanContactRoleCount = Object.keys(CaravanContactRole).length;

function caravanGenderKind(male: number, female: number): CaravanGenderKind {
  if (male > 0 && female > 0) return 'MIXED';
  if (male > 0) return 'MALE';
  if (female > 0) return 'FEMALE';
  return 'UNSPECIFIED';
}

const caravanInclude = {
  city: {
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
      province: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          countryId: true,
          country: {
            select: {
              id: true,
              nameFa: true,
              nameEn: true,
            },
          },
        },
      },
    },
  },
  walkingRoute: {
    select: {
      id: true,
      name: true,
    },
  },
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      nationalId: true,
      phone: true,
      birthDate: true,
      status: true,
    },
  },
  contacts: {
    orderBy: { role: 'asc' },
    select: {
      id: true,
      role: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          nationalId: true,
          phone: true,
          birthDate: true,
          status: true,
        },
      },
    },
  },
  years: {
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      managerUserId: true,
      maleCount: true,
      femaleCount: true,
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.CaravanInclude;

function toDateOnly(value?: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value?: string | null) {
  if (value == null || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

function issueFromRow(
  row: CaravanImportRow,
  reasons: string[],
): CaravanImportIssueRow {
  return {
    rowNumber: row.rowNumber,
    caravanName: row.caravanName,
    firstName: row.firstName,
    lastName: row.lastName,
    nationalId: row.nationalId ?? '',
    phone: row.phone,
    city: row.cityName ?? '',
    birthDate: row.birthDate ?? '',
    year: row.years.join('، '),
    reasons,
  };
}

@Injectable()
export class CaravansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: FindCaravansQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({
        where,
        include: caravanInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findMine(query: FindCaravansQueryDto, managerUserId: string) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const searchWhere = this.listWhere(query);
    const where: Prisma.CaravanWhereInput = {
      managerUserId,
      ...(searchWhere ? searchWhere : {}),
    };
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({
        where,
        include: caravanInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindCaravansQueryDto,
  ): Prisma.CaravanOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.CaravanOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        isActive: (dir) => ({ isActive: dir }),
        city: (dir) => ({ city: { nameFa: dir } }),
        walkingRoute: (dir) => ({ walkingRoute: { name: dir } }),
        manager: (dir) => ({ manager: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const caravan = await this.prisma.caravan.findUnique({
      where: { id },
      include: caravanInclude,
    });
    if (!caravan) {
      throw new NotFoundException('کاروان یافت نشد');
    }
    return caravan;
  }

  async findPilgrimageHistory(id: string, query: FindCaravanHistoryQueryDto) {
    await this.findOne(id);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where: Prisma.ReservationWhereInput = { caravanId: id };
    const orderBy = resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        year: (dir) => ({ year: dir }),
        status: (dir) => ({ status: dir }),
        stayStartDate: (dir) => ({ stayStartDate: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
        originCity: (dir) => ({ originCity: { nameFa: dir } }),
        totalCount: (dir) => ({ totalCount: dir }),
      },
      [{ year: 'desc' }, { stayStartDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    );
    const geoSelect = {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
    } as const;
    const personSelect = {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      nationalId: true,
      phone: true,
    } as const;

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          originCity: { select: geoSelect },
          walkingRoute: { select: { id: true, name: true } },
          caravanManager: { select: personSelect },
          createdBy: { select: personSelect },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return paginatedResult(
      items.map((row) => ({
        id: row.id,
        code: row.code,
        year: row.year,
        type: row.type,
        status: row.status,
        originCity: row.originCity,
        walkingRoute: row.walkingRoute,
        stayStartDate: toDateOnly(row.stayStartDate),
        stayEndDate: toDateOnly(row.stayEndDate),
        walkingStartDate: toDateOnly(row.walkingStartDate),
        requestsAccommodation: row.requestsAccommodation,
        requestsBus: row.requestsBus,
        requestsSimCard: row.requestsSimCard,
        requestsBankCard: row.requestsBankCard,
        specialServices: row.specialServices,
        requestedMaleCount: row.requestedMaleCount,
        requestedFemaleCount: row.requestedFemaleCount,
        maleCount: row.maleCount,
        femaleCount: row.femaleCount,
        totalCount: row.totalCount,
        memberCount: row._count.members,
        hasPermit: row.hasPermit,
        permitStatus: row.permitStatus,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        caravanManager: row.caravanManager,
        createdBy: row.createdBy,
      })),
      total,
      page,
      pageSize,
    );
  }

  private listWhere(query: FindCaravansQueryDto): Prisma.CaravanWhereInput | undefined {
    if (!query.q) return undefined;
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { officeAddress: containsInsensitive(query.q) },
        { officePhone: containsInsensitive(query.q) },
        { licenseNumber: containsInsensitive(query.q) },
        { city: { nameFa: containsInsensitive(query.q) } },
        { city: { nameEn: containsInsensitive(query.q) } },
        { walkingRoute: { name: containsInsensitive(query.q) } },
        { manager: { fullName: containsInsensitive(query.q) } },
        { manager: { nationalId: containsInsensitive(query.q) } },
        { manager: { phone: containsInsensitive(query.q) } },
        { eitaa: containsInsensitive(query.q) },
        { bale: containsInsensitive(query.q) },
        { telegram: containsInsensitive(query.q) },
        { instagram: containsInsensitive(query.q) },
      ],
    };
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
  }

  private assertCanActivateYear(
    caravan: { managerUserId: string | null },
    actor: Actor,
  ) {
    if (isAdmin(actor) || caravan.managerUserId === actor.id) {
      return;
    }
    throw new ForbiddenException('امکان فعال‌سازی سالانه این کاروان وجود ندارد');
  }

  private andWhere(
    base: Prisma.CaravanWhereInput | undefined,
    extra: Prisma.CaravanWhereInput,
  ): Prisma.CaravanWhereInput {
    if (!base || !Object.keys(base).length) {
      return extra;
    }
    return { AND: [base, extra] };
  }

  private async syncCurrentYearManager(
    caravanId: string,
    managerUserId: string | null,
  ) {
    const year = currentJalaliYear();
    const existing = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId, year } },
      select: { id: true },
    });
    if (!existing) return;
    await this.prisma.caravanYear.update({
      where: { id: existing.id },
      data: { managerUserId },
    });
  }

  private async syncCurrentYearCounts(
    caravanId: string,
    maleCount: number,
    femaleCount: number,
  ) {
    const year = currentJalaliYear();
    const existing = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId, year } },
      select: { id: true },
    });
    if (!existing) return;
    await this.prisma.caravanYear.update({
      where: { id: existing.id },
      data: { maleCount, femaleCount },
    });
  }

  private async validYearManagerId(userId: string | null | undefined) {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: { select: { code: true } } } } },
    });
    if (!user || !user.userRoles.some((item) => item.role.code === 'CARAVAN_MANAGER')) {
      return null;
    }
    return userId;
  }

  private async transferOneToYear(
    caravanId: string,
    sourceYear: number,
    targetYear: number,
    copyManagers: boolean,
  ): Promise<'ok' | 'skipped'> {
    const existing = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId, year: targetYear } },
      select: { id: true },
    });
    if (existing) {
      return 'skipped';
    }

    if (!copyManagers) {
      const caravan = await this.prisma.caravan.findUnique({
        where: { id: caravanId },
        select: { maleCount: true, femaleCount: true },
      });
      await this.prisma.caravanYear.create({
        data: {
          caravanId,
          year: targetYear,
          managerUserId: null,
          maleCount: caravan?.maleCount ?? 0,
          femaleCount: caravan?.femaleCount ?? 0,
        },
      });
      return 'ok';
    }

    const source = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId, year: sourceYear } },
      select: { managerUserId: true, maleCount: true, femaleCount: true },
    });
    const caravan = await this.prisma.caravan.findUnique({
      where: { id: caravanId },
      select: { managerUserId: true, maleCount: true, femaleCount: true },
    });
    const managerUserId = await this.validYearManagerId(
      source?.managerUserId ?? caravan?.managerUserId,
    );

    await this.prisma.caravanYear.create({
      data: {
        caravanId,
        year: targetYear,
        managerUserId,
        maleCount: source?.maleCount ?? caravan?.maleCount ?? 0,
        femaleCount: source?.femaleCount ?? caravan?.femaleCount ?? 0,
      },
    });

    if (targetYear === currentJalaliYear() && managerUserId) {
      await this.prisma.caravan.update({
        where: { id: caravanId },
        data: { managerUserId },
      });
    }

    return 'ok';
  }

  async create(dto: CreateCaravanDto, actor: RoleBearer & { id: string }) {
    const cityId = await this.resolveCityId(dto.cityId, actor.id);
    await this.assertLicenseImage(dto.licenseImageId);
    await this.assertWalkingRoute(dto.walkingRouteId);

    const managerUserId = isAdmin(actor)
      ? dto.managerUserId
      : actor.id;
    const resolved = await this.resolveManager(managerUserId);

    const caravan = await this.prisma.caravan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        officeAddress: dto.officeAddress?.trim() || null,
        officePhone: dto.officePhone?.trim() || null,
        foundedYear: dto.foundedYear ?? null,
        cityId,
        walkingRouteId: dto.walkingRouteId ?? null,
        licenseNumber: dto.licenseNumber?.trim() || null,
        licenseImageId: dto.licenseImageId ?? null,
        managerUserId: resolved.managerUserId,
        maleCount: dto.maleCount ?? 0,
        femaleCount: dto.femaleCount ?? 0,
        totalCount: (dto.maleCount ?? 0) + (dto.femaleCount ?? 0),
        eitaa: dto.eitaa?.trim() || null,
        bale: dto.bale?.trim() || null,
        telegram: dto.telegram?.trim() || null,
        instagram: dto.instagram?.trim() || null,
        isActive: dto.isActive ?? true,
        years: {
          create: {
            year: dto.year ?? currentJalaliYear(),
            managerUserId: resolved.managerUserId,
            maleCount: dto.maleCount ?? 0,
            femaleCount: dto.femaleCount ?? 0,
          },
        },
      },
      include: caravanInclude,
    });

    if (dto.contacts) {
      await this.syncContacts(caravan.id, dto.contacts);
      return this.findOne(caravan.id);
    }

    return caravan;
  }

  async update(
    id: string,
    dto: UpdateCaravanDto,
    actor: RoleBearer & { id: string },
  ) {
    const current = await this.findOne(id);
    if (dto.cityId) {
      await this.assertCity(dto.cityId);
    }
    if (dto.walkingRouteId !== undefined) {
      await this.assertWalkingRoute(dto.walkingRouteId);
    }
    if (dto.licenseImageId !== undefined) {
      await this.assertLicenseImage(dto.licenseImageId);
    }

    let resolved: { managerUserId: string | null } | null = null;
    if (isAdmin(actor)) {
      if (dto.managerUserId !== undefined) {
        resolved = await this.resolveManager(dto.managerUserId);
      }
    } else if (current.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان ویرایش این کاروان وجود ندارد');
    } else if (dto.managerUserId && dto.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان تغییر مدیر کاروان وجود ندارد');
    }

    const maleCount =
      dto.maleCount !== undefined ? dto.maleCount : current.maleCount;
    const femaleCount =
      dto.femaleCount !== undefined ? dto.femaleCount : current.femaleCount;
    const countsChanged =
      dto.maleCount !== undefined || dto.femaleCount !== undefined;

    const caravan = await this.prisma.caravan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        officeAddress:
          dto.officeAddress === undefined
            ? undefined
            : dto.officeAddress?.trim() || null,
        officePhone:
          dto.officePhone === undefined
            ? undefined
            : dto.officePhone?.trim() || null,
        foundedYear:
          dto.foundedYear === undefined ? undefined : dto.foundedYear,
        cityId: dto.cityId,
        walkingRouteId:
          dto.walkingRouteId === undefined ? undefined : dto.walkingRouteId,
        licenseNumber:
          dto.licenseNumber === undefined
            ? undefined
            : dto.licenseNumber?.trim() || null,
        licenseImageId:
          dto.licenseImageId === undefined ? undefined : dto.licenseImageId,
        managerUserId: resolved ? resolved.managerUserId : undefined,
        maleCount: dto.maleCount,
        femaleCount: dto.femaleCount,
        totalCount: countsChanged ? maleCount + femaleCount : undefined,
        eitaa: dto.eitaa === undefined ? undefined : dto.eitaa?.trim() || null,
        bale: dto.bale === undefined ? undefined : dto.bale?.trim() || null,
        telegram:
          dto.telegram === undefined ? undefined : dto.telegram?.trim() || null,
        instagram:
          dto.instagram === undefined ? undefined : dto.instagram?.trim() || null,
        isActive: isAdmin(actor) ? dto.isActive : undefined,
      },
      include: caravanInclude,
    });

    if (resolved) {
      await this.syncCurrentYearManager(id, resolved.managerUserId);
    }
    if (countsChanged) {
      await this.syncCurrentYearCounts(id, maleCount, femaleCount);
    }

    if (dto.contacts !== undefined) {
      await this.syncContacts(id, dto.contacts);
      return this.findOne(id);
    }

    if (resolved) {
      return this.findOne(id);
    }

    return caravan;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.caravan.delete({ where: { id } });
    return { ok: true };
  }

  async yearStats(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({});
    const [total, active, inactive] = await Promise.all([
      this.prisma.caravan.count({ where: scope }),
      this.prisma.caravan.count({
        where: this.andWhere(scope, { years: { some: { year: selectedYear } } }),
      }),
      this.prisma.caravan.count({
        where: this.andWhere(scope, { years: { none: { year: selectedYear } } }),
      }),
    ]);
    return { year: selectedYear, total, active, inactive };
  }

  async report(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const items = await this.prisma.caravan.findMany({
      select: {
        maleCount: true,
        femaleCount: true,
        walkingRouteId: true,
        walkingRoute: { select: { id: true, name: true } },
        city: {
          select: {
            province: {
              select: {
                id: true,
                nameFa: true,
                country: { select: { iso2: true, nameFa: true } },
              },
            },
          },
        },
        years: {
          where: { year: selectedYear },
          select: { managerUserId: true, maleCount: true, femaleCount: true },
        },
        _count: { select: { contacts: true } },
      },
    });

    const total = items.length;
    let withManager = 0;
    let withoutManager = 0;
    let activeInYear = 0;
    let inactiveInYear = 0;
    let capacityMale = 0;
    let capacityFemale = 0;
    let iranian = 0;
    let international = 0;
    let contactsComplete = 0;
    let contactsPartial = 0;
    let contactsNone = 0;

    const genderCount = new Map<CaravanGenderKind, number>(
      caravanGenderKinds.map((kind) => [kind, 0]),
    );
    const comboCount = new Map<string, number>();
    const routeCount = new Map<string, { id: string | null; name: string; count: number }>();
    const provinceCount = new Map<string, { id: string; name: string; count: number }>();

    for (const item of items) {
      const yearRow = item.years[0];
      if (yearRow) {
        activeInYear += 1;
        capacityMale += yearRow.maleCount;
        capacityFemale += yearRow.femaleCount;
        if (yearRow.managerUserId) withManager += 1;
        else withoutManager += 1;
      } else {
        inactiveInYear += 1;
        withoutManager += 1;
      }

      const male = yearRow ? yearRow.maleCount : item.maleCount;
      const female = yearRow ? yearRow.femaleCount : item.femaleCount;
      const genderType = caravanGenderKind(male, female);
      genderCount.set(genderType, (genderCount.get(genderType) ?? 0) + 1);

      const origin: CaravanOrigin =
        item.city.province.country.iso2 === 'IR' ? 'IRANIAN' : 'INTERNATIONAL';
      if (origin === 'IRANIAN') iranian += 1;
      else international += 1;

      const comboKey = `${genderType}:${origin}`;
      comboCount.set(comboKey, (comboCount.get(comboKey) ?? 0) + 1);

      const routeId = item.walkingRouteId ?? '';
      const routeName = item.walkingRoute?.name ?? '';
      const routeRow = routeCount.get(routeId) ?? {
        id: item.walkingRouteId,
        name: routeName,
        count: 0,
      };
      routeRow.count += 1;
      routeCount.set(routeId, routeRow);

      const province = item.city.province;
      const provinceRow = provinceCount.get(province.id) ?? {
        id: province.id,
        name: province.nameFa,
        count: 0,
      };
      provinceRow.count += 1;
      provinceCount.set(province.id, provinceRow);

      const contactCount = item._count.contacts;
      if (contactCount <= 0) contactsNone += 1;
      else if (contactCount >= caravanContactRoleCount) contactsComplete += 1;
      else contactsPartial += 1;
    }

    const byWalkingRoute = [...routeCount.values()].sort((a, b) => {
      if (!a.id && b.id) return 1;
      if (a.id && !b.id) return -1;
      return b.count - a.count || a.name.localeCompare(b.name, 'fa');
    });
    const byProvince = [...provinceCount.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fa'),
    );

    return {
      year: selectedYear,
      total,
      capacity: {
        male: capacityMale,
        female: capacityFemale,
        total: capacityMale + capacityFemale,
      },
      byManagerStatus: { withManager, withoutManager },
      byYearActivity: { active: activeInYear, inactive: inactiveInYear },
      byOrigin: { iranian, international },
      byContactStatus: {
        complete: contactsComplete,
        partial: contactsPartial,
        none: contactsNone,
      },
      byGenderType: caravanGenderKinds.map((genderType) => ({
        genderType,
        count: genderCount.get(genderType) ?? 0,
      })),
      byWalkingRoute,
      byProvince,
      byCombination: caravanGenderKinds.flatMap((genderType) =>
        caravanOrigins.map((origin) => ({
          genderType,
          origin,
          count: comboCount.get(`${genderType}:${origin}`) ?? 0,
        })),
      ),
    };
  }

  async findActiveInYear(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    return this.findYearList({ ...query, yearActivity: 'active' }, actor);
  }

  async findYearList(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const activity = query.yearActivity ?? 'all';
    const base = this.listWhere({ q: query.q });
    const yearFilter: Prisma.CaravanWhereInput =
      activity === 'active'
        ? { years: { some: { year: query.year } } }
        : activity === 'inactive'
          ? { years: { none: { year: query.year } } }
          : {};
    const where = this.andWhere(base, yearFilter);
    const findMany = {
      where,
      orderBy: this.listOrderBy({
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      }),
      include: caravanInclude,
    };

    const withFlag = <T extends { years: { year: number }[] }>(item: T) => ({
      ...item,
      activeInYear: item.years.some((row) => row.year === query.year),
    });

    if (!wantsPagination(query)) {
      const items = await this.prisma.caravan.findMany(findMany);
      return items.map(withFlag);
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({ ...findMany, skip, take }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items.map(withFlag), total, page, pageSize);
  }

  async findInactiveInYear(query: FindYearManagementQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const where = this.andWhere(this.listWhere({ q: query.q }), {
      years: { none: { year: query.year } },
    });
    const items = await this.prisma.caravan.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        city: { select: { id: true, nameFa: true, nameEn: true } },
      },
    });
    return items;
  }

  async addToYear(caravanId: string, actor: Actor, year?: number) {
    this.assertAdmin(actor);
    return this.activateYear(caravanId, actor, year, false);
  }

  async activateAllInactive(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({});
    const inactive = await this.prisma.caravan.findMany({
      where: this.andWhere(scope, {
        years: { none: { year: selectedYear } },
      }),
      select: { id: true, maleCount: true, femaleCount: true },
    });
    if (!inactive.length) {
      return { year: selectedYear, activated: 0 };
    }

    await this.prisma.caravanYear.createMany({
      data: inactive.map((item) => ({
        caravanId: item.id,
        year: selectedYear,
        managerUserId: null,
        maleCount: item.maleCount,
        femaleCount: item.femaleCount,
      })),
    });

    return { year: selectedYear, activated: inactive.length };
  }

  async deactivateAllActive(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({});
    const active = await this.prisma.caravan.findMany({
      where: this.andWhere(scope, {
        years: { some: { year: selectedYear } },
      }),
      select: { id: true },
    });
    if (!active.length) {
      return { year: selectedYear, removed: 0, caravans: 0 };
    }

    const result = await this.prisma.caravanYear.deleteMany({
      where: {
        year: selectedYear,
        caravanId: { in: active.map((item) => item.id) },
      },
    });

    return { year: selectedYear, removed: result.count, caravans: active.length };
  }

  async removeFromYear(caravanId: string, actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    await this.findOne(caravanId);
    const result = await this.prisma.caravanYear.deleteMany({
      where: { caravanId, year: selectedYear },
    });
    if (result.count === 0) {
      throw new NotFoundException('این کاروان در سال انتخاب‌شده فعال نیست');
    }
    return { ok: true, year: selectedYear, removed: result.count };
  }

  async transferYears(dto: TransferCaravansYearDto, actor: Actor) {
    this.assertAdmin(actor);
    const sourceYear = dto.sourceYear;
    const targetYear = dto.targetYear ?? currentJalaliYear();
    if (sourceYear === targetYear) {
      throw new BadRequestException('سال مبدأ و مقصد نباید یکسان باشند');
    }

    const copyManagers = dto.copyManagers !== false;
    const scope = this.listWhere({});
    const activeInSource = this.andWhere(scope, {
      years: { some: { year: sourceYear } },
    });

    let candidates: { id: string }[];
    if (dto.all) {
      candidates = await this.prisma.caravan.findMany({
        where: activeInSource,
        select: { id: true },
      });
    } else {
      const ids = [...new Set(dto.caravanIds ?? [])];
      if (!ids.length) {
        throw new BadRequestException('حداقل یک کاروان برای انتقال انتخاب کنید');
      }
      candidates = await this.prisma.caravan.findMany({
        where: this.andWhere(activeInSource, { id: { in: ids } }),
        select: { id: true },
      });
      if (candidates.length !== ids.length) {
        throw new BadRequestException(
          'برخی کاروان‌های انتخاب‌شده در سال مبدأ فعال نیستند',
        );
      }
    }

    let transferred = 0;
    let skipped = 0;
    const errors: { caravanId: string; message: string }[] = [];

    for (const { id } of candidates) {
      try {
        const result = await this.transferOneToYear(
          id,
          sourceYear,
          targetYear,
          copyManagers,
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
              : 'خطا در انتقال کاروان';
        errors.push({ caravanId: id, message });
      }
    }

    return {
      sourceYear,
      targetYear,
      copyManagers,
      requested: candidates.length,
      transferred,
      skipped,
      errors,
    };
  }

  async activateYear(
    id: string,
    actor: Actor,
    year?: number,
    copyPreviousManager = false,
  ) {
    const selectedYear = year ?? currentJalaliYear();
    const caravan = await this.findOne(id);
    this.assertCanActivateYear(caravan, actor);

    const existing = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId: id, year: selectedYear } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('وضعیت این کاروان برای این سال قبلاً مشخص شده است');
    }

    if (copyPreviousManager) {
      const previousYear = selectedYear - 1;
      const previous = await this.prisma.caravanYear.findUnique({
        where: { caravanId_year: { caravanId: id, year: previousYear } },
      });
      const previousManagerId = previous?.managerUserId ?? null;
      if (!previousManagerId) {
        throw new BadRequestException('مدیر سال قبل برای این کاروان یافت نشد');
      }
      const managerUserId = await this.validYearManagerId(previousManagerId);
      if (!managerUserId) {
        throw new BadRequestException('مدیر سال قبل دیگر معتبر نیست');
      }

      await this.prisma.caravanYear.create({
        data: {
          caravanId: id,
          year: selectedYear,
          managerUserId,
          maleCount: previous?.maleCount ?? caravan.maleCount,
          femaleCount: previous?.femaleCount ?? caravan.femaleCount,
        },
      });
      if (selectedYear === currentJalaliYear()) {
        await this.prisma.caravan.update({
          where: { id },
          data: { managerUserId },
        });
      }
      return this.findOne(id);
    }

    await this.prisma.caravanYear.create({
      data: {
        caravanId: id,
        year: selectedYear,
        managerUserId: null,
        maleCount: caravan.maleCount,
        femaleCount: caravan.femaleCount,
      },
    });
    return this.findOne(id);
  }

  async assignYear(
    id: string,
    year: number,
    managerUserId: string | null,
    actor: Actor,
    counts?: { maleCount?: number; femaleCount?: number },
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const caravan = await this.findOne(id);
    const resolved = await this.resolveManager(managerUserId);
    const maleCount = counts?.maleCount ?? caravan.maleCount;
    const femaleCount = counts?.femaleCount ?? caravan.femaleCount;
    const existing = await this.prisma.caravanYear.findUnique({
      where: { caravanId_year: { caravanId: id, year } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.caravanYear.update({
        where: { id: existing.id },
        data: {
          managerUserId: resolved.managerUserId,
          maleCount,
          femaleCount,
        },
      });
    } else {
      await this.prisma.caravanYear.create({
        data: {
          caravanId: id,
          year,
          managerUserId: resolved.managerUserId,
          maleCount,
          femaleCount,
        },
      });
    }

    if (year === currentJalaliYear()) {
      await this.prisma.caravan.update({
        where: { id },
        data: {
          managerUserId: resolved.managerUserId,
          maleCount,
          femaleCount,
          totalCount: maleCount + femaleCount,
        },
      });
    }

    return this.findOne(id);
  }

  async removeYear(id: string, yearId: string, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    await this.findOne(id);
    const row = await this.prisma.caravanYear.findFirst({
      where: { id: yearId, caravanId: id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('این سال فعالیت یافت نشد');
    }
    await this.prisma.caravanYear.delete({ where: { id: yearId } });
    return this.findOne(id);
  }

  count() {
    return this.prisma.caravan.count();
  }

  async previewImport(buffer: Buffer) {
    const parsed = await this.prepareImport(buffer);
    return {
      total: parsed.rows.length,
      invalid: parsed.invalid,
      invalidRows: parsed.invalidRows,
      adjusted: parsed.adjusted,
      adjustedRows: parsed.adjustedRows,
    };
  }

  async importFromExcel(buffer: Buffer) {
    const { rows, invalid, invalidRows, adjusted, adjustedRows } =
      await this.prepareImport(buffer);

    if (!rows.length) {
      return {
        total: 0,
        managersCreated: 0,
        managersReused: 0,
        caravansCreated: 0,
        caravansReused: 0,
        yearsAdded: 0,
        yearsSkipped: 0,
        invalid,
        invalidRows,
        adjusted,
        adjustedRows,
      };
    }

    const [pilgrimRole, managerRole, iran, fallbackCityId] = await Promise.all([
      this.prisma.role.findUnique({ where: { code: 'PILGRIM' } }),
      this.prisma.role.findUnique({ where: { code: 'CARAVAN_MANAGER' } }),
      this.prisma.country.findUnique({
        where: { iso2: 'IR' },
        select: { id: true },
      }),
      this.resolveFallbackCityId(),
    ]);
    if (!pilgrimRole || !managerRole) {
      throw new BadRequestException('نقش زائر یا مدیر کاروان در سامانه یافت نشد');
    }
    if (!fallbackCityId) {
      throw new BadRequestException('شهری برای ثبت کاروان در سامانه یافت نشد');
    }

    const cityIds = [
      ...new Set(rows.map((row) => row.cityId).filter((id): id is string => Boolean(id))),
    ];
    const cityGeo = await this.loadCityGeoMap(cityIds);
    const iranCountryId = iran?.id ?? null;
    const currentYear = currentJalaliYear();

    const existingCaravans = await this.prisma.caravan.findMany({
      select: { id: true, name: true, managerUserId: true, maleCount: true, femaleCount: true },
    });
    const caravanByName = new Map(
      existingCaravans.map((item) => [normalizeCaravanNameKey(item.name), item]),
    );

    const existingYears = await this.prisma.caravanYear.findMany({
      select: { caravanId: true, year: true },
    });
    const yearKeys = new Set(
      existingYears.map((item) => `${item.caravanId}:${item.year}`),
    );

    const passwordBySecret = new Map<string, string>();
    const conflictRows: CaravanImportIssueRow[] = [];
    let managersCreated = 0;
    let managersReused = 0;
    let caravansCreated = 0;
    let caravansReused = 0;
    let yearsAdded = 0;
    let yearsSkipped = 0;

    for (const row of rows) {
      const manager = await this.resolveImportManager(row, {
        pilgrimRoleId: pilgrimRole.id,
        managerRoleId: managerRole.id,
        cityGeo,
        iranCountryId,
        passwordBySecret,
      });
      if ('error' in manager) {
        conflictRows.push(issueFromRow(row, [manager.error]));
        continue;
      }
      if (manager.created) managersCreated += 1;
      else managersReused += 1;

      const nameKey = normalizeCaravanNameKey(row.caravanName);
      let caravan = caravanByName.get(nameKey);
      if (!caravan) {
        const cityId = row.cityId || fallbackCityId;
        const created = await this.prisma.caravan.create({
          data: {
            name: row.caravanName,
            cityId,
            managerUserId: manager.id,
            isActive: true,
          },
          select: { id: true, name: true, managerUserId: true, maleCount: true, femaleCount: true },
        });
        caravan = created;
        caravanByName.set(nameKey, created);
        caravansCreated += 1;
      } else {
        caravansReused += 1;
      }

      if (!row.years.length) continue;

      const toCreate: {
        caravanId: string
        year: number
        managerUserId: string
        maleCount: number
        femaleCount: number
      }[] = [];
      for (const year of row.years) {
        const key = `${caravan.id}:${year}`;
        if (yearKeys.has(key)) {
          yearsSkipped += 1;
          continue;
        }
        toCreate.push({
          caravanId: caravan.id,
          year,
          managerUserId: manager.id,
          maleCount: caravan.maleCount ?? 0,
          femaleCount: caravan.femaleCount ?? 0,
        });
        yearKeys.add(key);
      }
      if (toCreate.length) {
        await this.prisma.caravanYear.createMany({ data: toCreate });
        yearsAdded += toCreate.length;
      }

      if (row.years.includes(currentYear) && caravan.managerUserId !== manager.id) {
        await this.prisma.caravan.update({
          where: { id: caravan.id },
          data: { managerUserId: manager.id },
        });
        caravan.managerUserId = manager.id;
      }
    }

    const allInvalidRows = [...invalidRows, ...conflictRows].sort(
      (a, b) => a.rowNumber - b.rowNumber,
    );

    return {
      total: rows.length,
      managersCreated,
      managersReused,
      caravansCreated,
      caravansReused,
      yearsAdded,
      yearsSkipped,
      invalid: allInvalidRows.length,
      invalidRows: allInvalidRows,
      adjusted,
      adjustedRows,
    };
  }

  private async prepareImport(buffer: Buffer): Promise<ParsedCaravanImport> {
    const parsed = await parseCaravanImportExcel(buffer);
    if (!parsed.rows.length && parsed.invalid === 0) {
      throw new BadRequestException('فایل اکسل خالی است یا قالب آن صحیح نیست');
    }
    const withCities = await this.resolveImportCities(parsed);
    return this.rejectNewManagersWithoutName(withCities);
  }

  private async rejectNewManagersWithoutName(
    parsed: ParsedCaravanImport,
  ): Promise<ParsedCaravanImport> {
    const missingName = parsed.rows.filter(
      (row) => !row.firstName.trim() || !row.lastName.trim(),
    );
    if (!missingName.length) return parsed;

    const phones = [...new Set(missingName.map((row) => row.phone))];
    const nationalIds = [
      ...new Set(missingName.map((row) => row.nationalId).filter((id): id is string => Boolean(id))),
    ];
    const existing = await this.prisma.user.findMany({
      where: {
        OR: [
          ...(nationalIds.length ? [{ nationalId: { in: nationalIds } }] : []),
          ...(phones.length ? [{ phone: { in: phones } }] : []),
        ],
      },
      select: { nationalId: true, phone: true },
    });
    const knownNationalIds = new Set(
      existing.map((item) => item.nationalId).filter((id): id is string => Boolean(id)),
    );
    const knownPhones = new Set(
      existing.map((item) => item.phone).filter((id): id is string => Boolean(id)),
    );

    const rows: CaravanImportRow[] = [];
    const invalidRows = [...parsed.invalidRows];
    for (const row of parsed.rows) {
      const known =
        (row.nationalId ? knownNationalIds.has(row.nationalId) : false) ||
        knownPhones.has(row.phone);
      if ((!row.firstName.trim() || !row.lastName.trim()) && !known) {
        invalidRows.push(issueFromRow(row, ['missingManagerName']));
        continue;
      }
      rows.push(row);
    }

    return {
      rows,
      invalid: invalidRows.length,
      invalidRows: invalidRows.sort((a, b) => a.rowNumber - b.rowNumber),
      adjusted: parsed.adjusted,
      adjustedRows: parsed.adjustedRows,
    };
  }

  private async resolveImportCities(
    parsed: ParsedCaravanImport,
  ): Promise<ParsedCaravanImport> {
    const names = [
      ...new Set(
        parsed.rows
          .map((row) => row.cityName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    const cityIdByKey = new Map<string, string>();
    if (names.length) {
      const cities = await this.prisma.city.findMany({
        where: { isActive: true },
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          isProvinceCapital: true,
          sortOrder: true,
        },
        orderBy: [{ isProvinceCapital: 'desc' }, { sortOrder: 'asc' }],
      });
      for (const city of cities) {
        for (const key of cityLookupKeys(city.nameFa, city.nameEn)) {
          if (!cityIdByKey.has(key)) {
            cityIdByKey.set(key, city.id);
          }
        }
      }
    }

    const rows: CaravanImportRow[] = [];
    const adjustedByRow = new Map<number, CaravanImportIssueRow>();
    for (const item of parsed.adjustedRows) {
      adjustedByRow.set(item.rowNumber, { ...item, reasons: [...item.reasons] });
    }

    for (const row of parsed.rows) {
      if (!row.cityName) {
        rows.push({ ...row, cityId: null });
        continue;
      }
      const cityId = cityIdByKey.get(normalizeCityLookupKey(row.cityName));
      if (!cityId) {
        const adjustments = [...row.adjustments, 'clearedCity'];
        rows.push({ ...row, cityName: null, cityId: null, adjustments });
        const existing = adjustedByRow.get(row.rowNumber);
        if (existing) {
          existing.reasons = [...existing.reasons, 'clearedCity'];
          if (!existing.city) existing.city = row.cityName;
        } else {
          adjustedByRow.set(row.rowNumber, issueFromRow(row, ['clearedCity']));
        }
        continue;
      }
      rows.push({ ...row, cityId });
    }

    const adjustedRows = [...adjustedByRow.values()].sort(
      (a, b) => a.rowNumber - b.rowNumber,
    );

    return {
      rows,
      invalid: parsed.invalidRows.length,
      invalidRows: parsed.invalidRows,
      adjusted: adjustedRows.length,
      adjustedRows,
    };
  }

  private async resolveFallbackCityId() {
    const mashhad = await this.prisma.city.findFirst({
      where: {
        isActive: true,
        OR: [
          { nameFa: 'مشهد' },
          { nameEn: { equals: 'Mashhad', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (mashhad) return mashhad.id;
    const anyCity = await this.prisma.city.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return anyCity?.id ?? null;
  }

  private async loadCityGeoMap(cityIds: string[]) {
    const map = new Map<string, { provinceId: string; countryId: string }>();
    if (!cityIds.length) return map;
    const cities = await this.prisma.city.findMany({
      where: { id: { in: cityIds } },
      select: {
        id: true,
        provinceId: true,
        province: { select: { countryId: true } },
      },
    });
    for (const city of cities) {
      map.set(city.id, {
        provinceId: city.provinceId,
        countryId: city.province.countryId,
      });
    }
    return map;
  }

  private async resolveImportManager(
    row: CaravanImportRow,
    ctx: {
      pilgrimRoleId: string;
      managerRoleId: string;
      cityGeo: Map<string, { provinceId: string; countryId: string }>;
      iranCountryId: string | null;
      passwordBySecret: Map<string, string>;
    },
  ): Promise<{ id: string; created: boolean } | { error: string }> {
    let existing = row.nationalId
      ? await this.prisma.user.findUnique({
          where: { nationalId: row.nationalId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            nationalId: true,
            birthDate: true,
            cityId: true,
          },
        })
      : null;

    if (!existing) {
      existing = await this.prisma.user.findUnique({
        where: { phone: row.phone },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          nationalId: true,
          birthDate: true,
          cityId: true,
        },
      });
      if (
        existing &&
        row.nationalId &&
        existing.nationalId &&
        existing.nationalId !== row.nationalId
      ) {
        return { error: 'phoneTaken' };
      }
    }

    if (existing) {
      if (row.phone && existing.phone && existing.phone !== row.phone) {
        const phoneOwner = await this.prisma.user.findUnique({
          where: { phone: row.phone },
          select: { id: true },
        });
        if (phoneOwner && phoneOwner.id !== existing.id) {
          return { error: 'phoneTaken' };
        }
      }
      await this.users.ensureRole(existing.id, 'PILGRIM');
      await this.users.ensureRole(existing.id, 'CARAVAN_MANAGER');
      const patch: Prisma.UserUpdateInput = {};
      if (row.firstName && row.lastName && (!existing.firstName || !existing.lastName)) {
        patch.firstName = row.firstName;
        patch.lastName = row.lastName;
        patch.fullName = joinFullName(row.firstName, row.lastName);
      }
      if (row.phone && !existing.phone) patch.phone = row.phone;
      if (row.nationalId && !existing.nationalId) patch.nationalId = row.nationalId;
      if (row.birthDate && !existing.birthDate) {
        patch.birthDate = parseDateOnly(row.birthDate);
      }
      if (row.cityId && !existing.cityId) {
        const geo = ctx.cityGeo.get(row.cityId);
        patch.city = { connect: { id: row.cityId } };
        if (geo) {
          patch.province = { connect: { id: geo.provinceId } };
          patch.country = { connect: { id: geo.countryId } };
        }
      }
      if (Object.keys(patch).length) {
        try {
          await this.prisma.user.update({ where: { id: existing.id }, data: patch });
        } catch {
          // uniqueness on phone/nationalId should not block granting the manager role
        }
      }
      return { id: existing.id, created: false };
    }

    if (!row.firstName.trim() || !row.lastName.trim()) {
      return { error: 'missingManagerName' };
    }

    const secret = row.nationalId || row.phone;
    let passwordHash = ctx.passwordBySecret.get(secret);
    if (!passwordHash) {
      passwordHash = await bcrypt.hash(secret, 8);
      ctx.passwordBySecret.set(secret, passwordHash);
    }

    let username = secret;
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (usernameTaken) {
      username = `${secret}_${Date.now().toString(36)}`;
    }

    const geo = row.cityId ? ctx.cityGeo.get(row.cityId) : undefined;
    try {
      const created = await this.prisma.user.create({
        data: {
          username,
          passwordHash,
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: joinFullName(row.firstName, row.lastName),
          locale: 'fa',
          status: UserStatus.ACTIVE,
          nationalId: row.nationalId,
          phone: row.phone,
          birthDate: parseDateOnly(row.birthDate),
          cityId: row.cityId ?? null,
          provinceId: geo?.provinceId ?? null,
          countryId: geo?.countryId ?? ctx.iranCountryId,
          userRoles: {
            create: [
              { roleId: ctx.pilgrimRoleId },
              { roleId: ctx.managerRoleId },
            ],
          },
        },
        select: { id: true },
      });
      return { id: created.id, created: true };
    } catch {
      return { error: 'phoneTaken' };
    }
  }

  private async resolveManager(managerUserId?: string | null) {
    if (!managerUserId) {
      return { managerUserId: null };
    }

    await this.users.ensureRole(managerUserId, 'PILGRIM');
    await this.users.ensureRole(managerUserId, 'CARAVAN_MANAGER');
    return { managerUserId };
  }

  private async resolveCityId(cityId: string | null | undefined, actorId: string) {
    const resolved = cityId || (await this.actorCityId(actorId));
    if (!resolved) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    await this.assertCity(resolved);
    return resolved;
  }

  private async actorCityId(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { cityId: true },
    });
    return actor?.cityId ?? null;
  }

  private async assertCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
  }

  private async assertWalkingRoute(routeId?: string | null) {
    if (!routeId) return;
    const route = await this.prisma.walkingRoute.findUnique({
      where: { id: routeId },
      select: { id: true },
    });
    if (!route) {
      throw new BadRequestException('مسیر پیاده‌روی معتبر نیست');
    }
  }

  private async assertLicenseImage(imageId?: string | null) {
    if (!imageId) return;
    const image = await this.prisma.storedImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('تصویر مجوز معتبر نیست');
    }
  }

  private async syncContacts(
    caravanId: string,
    contacts: NonNullable<CreateCaravanDto['contacts']>,
  ) {
    if (!contacts.length) {
      await this.prisma.caravanContact.deleteMany({ where: { caravanId } });
      return;
    }

    const roles = contacts.map((item) => item.role);
    await this.prisma.caravanContact.deleteMany({
      where: {
        caravanId,
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

      await this.prisma.caravanContact.upsert({
        where: {
          caravanId_role: { caravanId, role: contact.role },
        },
        create: {
          caravanId,
          role: contact.role,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }
  }
}
