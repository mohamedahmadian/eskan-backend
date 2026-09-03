import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import { currentJalaliYear, jalaliYearRange } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma, ReservationStationStayStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateWalkingStationDto } from './dto/create-walking-station.dto';
import { FindStationReportQueryDto } from './dto/find-station-report-query.dto';
import { FindStationStaysQueryDto } from './dto/find-station-stays-query.dto';
import { FindWalkingStationsQueryDto } from './dto/find-walking-stations-query.dto';
import { UpdateWalkingStationDto } from './dto/update-walking-station.dto';

export type StationActor = {
  id: string;
  userRoles?: { role: { code: string } }[];
  roles?: { code: string }[];
};

const STATION_MANAGER_ROLE = 'STATION_MANAGER';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const walkingStationInclude = {
  city: {
    select: {
      ...geoSelect,
      provinceId: true,
      latitude: true,
      longitude: true,
      province: { select: { ...geoSelect, countryId: true } },
    },
  },
  routeStages: {
    orderBy: { stageNumber: 'asc' as const },
    select: {
      id: true,
      stageNumber: true,
      walkingRoute: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.WalkingStationInclude;

type WalkingStationRecord = Prisma.WalkingStationGetPayload<{
  include: typeof walkingStationInclude;
}>;

const stayPersonSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
} as const;

const stayReservationInclude = {
  id: true,
  code: true,
  type: true,
  status: true,
  year: true,
  walkingStartDate: true,
  walkingRoute: { select: { id: true, name: true } },
  caravan: { select: { id: true, name: true } },
  group: {
    select: {
      id: true,
      name: true,
      manager: { select: stayPersonSelect },
    },
  },
  createdBy: { select: stayPersonSelect },
  caravanManager: { select: stayPersonSelect },
} satisfies Prisma.ReservationSelect;

@Injectable()
export class WalkingStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: FindWalkingStationsQueryDto, actor?: StationActor) {
    const where = this.listWhere(query, actor);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.walkingStation.findMany({
        where,
        orderBy,
        include: walkingStationInclude,
      });
      const occupied = await this.occupancyByStation(items.map((item) => item.id));
      return items.map((item) =>
        this.serialize(item, occupied.get(item.id) ?? { male: 0, female: 0 }),
      );
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.walkingStation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: walkingStationInclude,
      }),
      this.prisma.walkingStation.count({ where }),
    ]);
    const occupied = await this.occupancyByStation(items.map((item) => item.id));
    return paginatedResult(
      items.map((item) =>
        this.serialize(item, occupied.get(item.id) ?? { male: 0, female: 0 }),
      ),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string, actor?: StationActor) {
    const item = await this.prisma.walkingStation.findUnique({
      where: { id },
      include: walkingStationInclude,
    });
    if (!item) {
      throw new NotFoundException('ایستگاه یافت نشد');
    }
    this.assertCanAccess(item, actor);
    const occupied = await this.occupancyByStation([id]);
    return this.serialize(item, occupied.get(id) ?? { male: 0, female: 0 });
  }

  async findMine(query: FindWalkingStationsQueryDto, actor: StationActor) {
    return this.findAll(query, actor);
  }

  async findPublicOne(id: string) {
    const item = await this.prisma.walkingStation.findUnique({
      where: { id },
      include: walkingStationInclude,
    });
    if (!item) {
      throw new NotFoundException('ایستگاه یافت نشد');
    }
    const publicItem = this.serialize(item);
    const { occupiedMaleCount: _occupiedMale, occupiedFemaleCount: _occupiedFemale, ...rest } =
      publicItem;
    return rest;
  }

  async listStays(id: string, query: FindStationStaysQueryDto, actor?: StationActor) {
    await this.findOne(id, actor);
    const where = this.stayWhere({ ...query, stationId: id }, actor);
    const items = await this.prisma.reservationStationStay.findMany({
      where,
      orderBy: this.stayOrderBy(query),
      include: {
        reservation: { select: stayReservationInclude },
        reservedBy: { select: { id: true, fullName: true } },
        cancelledBy: { select: { id: true, fullName: true } },
        evacuatedBy: { select: { id: true, fullName: true } },
      },
    });
    return { items: items.map((item) => this.serializeStay(item)) };
  }

  async updateStayPresence(
    stationId: string,
    stayId: string,
    present: boolean,
    actor?: StationActor,
  ) {
    await this.findOne(stationId, actor);
    const stay = await this.prisma.reservationStationStay.findFirst({
      where: { id: stayId, walkingStationId: stationId },
    });
    if (!stay) {
      throw new NotFoundException('رزرو ایستگاه یافت نشد');
    }
    if (stay.status !== ReservationStationStayStatus.RESERVED) {
      throw new BadRequestException('فقط برای رزرو فعال می‌توان وضعیت حضور را ثبت کرد');
    }
    const updated = await this.prisma.reservationStationStay.update({
      where: { id: stayId },
      data: { present },
    });
    return { id: updated.id, present: updated.present };
  }

  async evacuate(id: string, actor: StationActor) {
    await this.findOne(id, actor);
    const now = new Date();
    const result = await this.prisma.reservationStationStay.updateMany({
      where: {
        walkingStationId: id,
        status: ReservationStationStayStatus.RESERVED,
      },
      data: {
        status: ReservationStationStayStatus.EVACUATED,
        evacuatedAt: now,
        evacuatedById: actor.id,
      },
    });
    return { ok: true, count: result.count };
  }

  async create(dto: CreateWalkingStationDto) {
    const city = await this.assertIranCity(dto.cityId);
    this.assertCoords(dto.latitude, dto.longitude);
    const item = await this.prisma.walkingStation.create({
      data: await this.stationData(dto, city.id),
      include: walkingStationInclude,
    });
    await this.syncStationManagerRole(item.managerUserId);
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateWalkingStationDto, actor?: StationActor) {
    const current = await this.findOne(id, actor);
    const previousManagerId = current.managerUserId;
    const cityId = dto.cityId ?? current.cityId;
    if (dto.cityId) {
      await this.assertIranCity(dto.cityId);
    }
    const latitude = dto.latitude === undefined ? current.latitude : dto.latitude;
    const longitude =
      dto.longitude === undefined ? current.longitude : dto.longitude;
    this.assertCoords(latitude, longitude);
    const item = await this.prisma.walkingStation.update({
      where: { id },
      data: await this.stationData(dto, cityId, true),
      include: walkingStationInclude,
    });
    if (previousManagerId !== item.managerUserId) {
      await this.syncStationManagerRole(previousManagerId);
      await this.syncStationManagerRole(item.managerUserId);
    } else if (item.managerUserId) {
      await this.syncStationManagerRole(item.managerUserId);
    }
    return this.serialize(item);
  }

  async remove(id: string, actor?: StationActor) {
    const current = await this.findOne(id, actor);
    const used = await this.prisma.walkingRouteStage.count({
      where: { walkingStationId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'این ایستگاه در مسیر پیاده استفاده شده و قابل حذف نیست',
      );
    }
    await this.prisma.walkingStation.delete({ where: { id } });
    await this.syncStationManagerRole(current.managerUserId);
    return { ok: true };
  }

  private listWhere(
    query: FindWalkingStationsQueryDto,
    actor?: StationActor,
  ): Prisma.WalkingStationWhereInput {
    const filters: Prisma.WalkingStationWhereInput[] = [];
    if (actor && !isAdmin(actor)) {
      filters.push({ managerUserId: actor.id });
    }
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    } else if (query.provinceId) {
      filters.push({ city: { provinceId: query.provinceId } });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { neshanAddress: containsInsensitive(query.q) },
          { managerName: containsInsensitive(query.q) },
          { managerPhone: containsInsensitive(query.q) },
          { manager: { fullName: containsInsensitive(query.q) } },
          { manager: { phone: containsInsensitive(query.q) } },
          { heatingSystem: containsInsensitive(query.q) },
          { coolingSystem: containsInsensitive(query.q) },
          { city: { nameFa: containsInsensitive(query.q) } },
          { city: { nameEn: containsInsensitive(query.q) } },
          { city: { province: { nameFa: containsInsensitive(query.q) } } },
          { city: { province: { nameEn: containsInsensitive(query.q) } } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindWalkingStationsQueryDto,
  ): Prisma.WalkingStationOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.WalkingStationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        managerName: (dir) => ({ managerName: dir }),
        province: (dir) => ({ city: { province: { nameFa: dir } } }),
        city: (dir) => ({ city: { nameFa: dir } }),
        address: (dir) => ({ address: dir }),
        maleCount: (dir) => ({ maleCount: dir }),
        femaleCount: (dir) => ({ femaleCount: dir }),
        routeCount: (dir) => ({ routeStages: { _count: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private async assertIranCity(cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: { province: { include: { country: true } } },
    });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (city.province.country.iso2 !== 'IR') {
      throw new BadRequestException('ایستگاه فقط می‌تواند در شهرهای ایران باشد');
    }
    return city;
  }

  private assertCoords(
    latitude?: number | null,
    longitude?: number | null,
  ) {
    const hasLat = latitude != null;
    const hasLng = longitude != null;
    if (hasLat !== hasLng) {
      throw new BadRequestException('موقعیت مکانی ایستگاه ناقص است');
    }
  }

  private async stationData(
    dto: CreateWalkingStationDto | UpdateWalkingStationDto,
    cityId: string,
    partial = false,
  ) {
    const decimal = (value: number | null | undefined) => {
      if (value === undefined) {
        return partial ? undefined : null;
      }
      return value == null ? null : new Prisma.Decimal(value);
    };
    return {
      cityId,
      name: dto.name === undefined ? undefined : dto.name.trim(),
      latitude: decimal(dto.latitude),
      longitude: decimal(dto.longitude),
      address:
        dto.address === undefined ? undefined : dto.address?.trim() || null,
      neshanAddress:
        dto.neshanAddress === undefined
          ? undefined
          : dto.neshanAddress?.trim() || null,
      maleCount:
        dto.maleCount === undefined ? (partial ? undefined : 0) : dto.maleCount,
      femaleCount:
        dto.femaleCount === undefined
          ? (partial ? undefined : 0)
          : dto.femaleCount,
      ...(await this.managerFields(dto.managerUserId, partial)),
      distanceToMashhadKm: decimal(dto.distanceToMashhadKm),
      description:
        dto.description === undefined
          ? undefined
          : dto.description?.trim() || null,
      hasLaundry:
        dto.hasLaundry === undefined
          ? partial
            ? undefined
            : false
          : dto.hasLaundry,
      hasInternet:
        dto.hasInternet === undefined
          ? partial
            ? undefined
            : false
          : dto.hasInternet,
      hasPrayerRoom:
        dto.hasPrayerRoom === undefined
          ? partial
            ? undefined
            : false
          : dto.hasPrayerRoom,
      hasElevator:
        dto.hasElevator === undefined
          ? partial
            ? undefined
            : false
          : dto.hasElevator,
      heatingSystem:
        dto.heatingSystem === undefined
          ? undefined
          : dto.heatingSystem?.trim() || null,
      coolingSystem:
        dto.coolingSystem === undefined
          ? undefined
          : dto.coolingSystem?.trim() || null,
      parkingCapacity:
        dto.parkingCapacity === undefined ? undefined : dto.parkingCapacity,
      bathroomCount:
        dto.bathroomCount === undefined ? undefined : dto.bathroomCount,
      toiletCount: dto.toiletCount === undefined ? undefined : dto.toiletCount,
      areaSqm: decimal(dto.areaSqm),
    };
  }

  private async ensureStationManagerRoleRecord() {
    await this.prisma.role.upsert({
      where: { code: STATION_MANAGER_ROLE },
      update: { nameKey: 'roles.stationManager' },
      create: {
        code: STATION_MANAGER_ROLE,
        nameKey: 'roles.stationManager',
      },
    });
  }

  private async syncStationManagerRole(userId: string | null | undefined) {
    if (!userId) {
      return;
    }
    await this.ensureStationManagerRoleRecord();
    const stillManages = await this.prisma.walkingStation.count({
      where: { managerUserId: userId },
    });
    if (stillManages > 0) {
      await this.users.ensureRole(userId, STATION_MANAGER_ROLE);
      return;
    }
    await this.prisma.userRole.deleteMany({
      where: { userId, role: { code: STATION_MANAGER_ROLE } },
    });
  }

  async history(query: FindStationStaysQueryDto, actor: StationActor) {
    const where = this.stayWhere(query, actor);
    const orderBy = this.stayOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.reservationStationStay.findMany({
        where,
        orderBy,
        include: {
          walkingStation: { select: { id: true, name: true } },
          reservation: { select: stayReservationInclude },
          reservedBy: { select: { id: true, fullName: true } },
          cancelledBy: { select: { id: true, fullName: true } },
          evacuatedBy: { select: { id: true, fullName: true } },
        },
      });
      return items.map((item) => this.serializeStay(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.reservationStationStay.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          walkingStation: { select: { id: true, name: true } },
          reservation: { select: stayReservationInclude },
          reservedBy: { select: { id: true, fullName: true } },
          cancelledBy: { select: { id: true, fullName: true } },
          evacuatedBy: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.reservationStationStay.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeStay(item)),
      total,
      page,
      pageSize,
    );
  }

  async report(query: FindStationReportQueryDto, actor: StationActor) {
    const year = query.year ?? currentJalaliYear();
    const range = jalaliYearRange(year);
    if (query.stationId) {
      await this.findOne(query.stationId, actor);
    }
    const stationFilter = this.managedStationFilter(actor, query.stationId);
    const stays = await this.prisma.reservationStationStay.findMany({
      where: {
        ...stationFilter,
        stayDate: { gte: range.gte, lt: range.lt },
      },
      select: {
        stayDate: true,
        mealType: true,
        maleCount: true,
        femaleCount: true,
        status: true,
        present: true,
        reservationId: true,
        reservation: { select: { type: true } },
      },
    });
    const stations = await this.prisma.walkingStation.findMany({
      where: actor && !isAdmin(actor) ? { managerUserId: actor.id } : query.stationId
        ? { id: query.stationId }
        : {},
      select: {
        id: true,
        name: true,
        maleCount: true,
        femaleCount: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const byDayMap = new Map<
      string,
      { total: number; present: number; absent: number; male: number; female: number }
    >();
    const byMealMap = new Map<string, number>();
    const byTypeMap = new Map<string, number>();
    const byMonthMap = new Map<
      number,
      { total: number; present: number; absent: number }
    >();
    const reservationIds = new Set<string>();
    let present = 0;
    let absent = 0;
    let cancelled = 0;
    let evacuated = 0;
    let reserved = 0;
    let male = 0;
    let female = 0;
    for (const stay of stays) {
      const date = stay.stayDate.toISOString().slice(0, 10);
      const day = byDayMap.get(date) ?? {
        total: 0,
        present: 0,
        absent: 0,
        male: 0,
        female: 0,
      };
      day.total += 1;
      day.male += stay.maleCount;
      day.female += stay.femaleCount;
      if (stay.status === ReservationStationStayStatus.RESERVED) {
        reserved += 1;
        if (stay.present) {
          present += 1;
          day.present += 1;
        } else {
          absent += 1;
          day.absent += 1;
        }
      } else if (stay.status === ReservationStationStayStatus.CANCELLED) {
        cancelled += 1;
      } else if (stay.status === ReservationStationStayStatus.EVACUATED) {
        evacuated += 1;
      }
      byDayMap.set(date, day);
      byMealMap.set(stay.mealType, (byMealMap.get(stay.mealType) ?? 0) + 1);
      byTypeMap.set(stay.reservation.type, (byTypeMap.get(stay.reservation.type) ?? 0) + 1);
      const month = Number(
        new Intl.DateTimeFormat('en-US-u-ca-persian', {
          month: 'numeric',
          timeZone: 'Asia/Tehran',
        }).format(stay.stayDate),
      );
      const monthRow = byMonthMap.get(month) ?? { total: 0, present: 0, absent: 0 };
      monthRow.total += 1;
      if (stay.status === ReservationStationStayStatus.RESERVED) {
        if (stay.present) monthRow.present += 1;
        else monthRow.absent += 1;
      }
      byMonthMap.set(month, monthRow);
      reservationIds.add(stay.reservationId);
      male += stay.maleCount;
      female += stay.femaleCount;
    }
    const selected = query.stationId
      ? stations.find((item) => item.id === query.stationId)
      : stations.length === 1
        ? stations[0]
        : null;
    return {
      year,
      stationId: query.stationId ?? null,
      stations: stations.map((item) => ({
        id: item.id,
        name: item.name,
        maleCount: item.maleCount,
        femaleCount: item.femaleCount,
      })),
      totals: {
        stays: stays.length,
        reserved,
        present,
        absent,
        cancelled,
        evacuated,
        male,
        female,
        reservations: reservationIds.size,
      },
      capacity: selected
        ? {
            male: selected.maleCount,
            female: selected.femaleCount,
          }
        : null,
      byDay: [...byDayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, row]) => ({ date, ...row })),
      byMeal: [...byMealMap.entries()].map(([mealType, count]) => ({
        mealType,
        count,
      })),
      byType: [...byTypeMap.entries()].map(([type, count]) => ({ type, count })),
      byMonth: [...byMonthMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([month, row]) => ({ month, ...row })),
    };
  }

  private assertCanAccess(
    item: { managerUserId: string | null },
    actor?: StationActor,
  ) {
    if (!actor || isAdmin(actor)) {
      return;
    }
    if (item.managerUserId !== actor.id) {
      throw new ForbiddenException('دسترسی به این ایستگاه مجاز نیست');
    }
  }

  private managedStationFilter(
    actor: StationActor,
    stationId?: string,
  ): Prisma.ReservationStationStayWhereInput {
    const walkingStation = stationId
      ? isAdmin(actor)
        ? { id: stationId }
        : { id: stationId, managerUserId: actor.id }
      : isAdmin(actor)
        ? undefined
        : { managerUserId: actor.id };
    return walkingStation ? { walkingStation } : {};
  }

  private stayWhere(
    query: FindStationStaysQueryDto,
    actor?: StationActor,
  ): Prisma.ReservationStationStayWhereInput {
    const filters: Prisma.ReservationStationStayWhereInput[] = [];
    if (actor) {
      filters.push(this.managedStationFilter(actor, query.stationId));
    } else if (query.stationId) {
      filters.push({ walkingStationId: query.stationId });
    }
    if (query.stayDate) {
      filters.push({ stayDate: new Date(`${query.stayDate}T00:00:00.000Z`) });
    } else if (query.from || query.to) {
      filters.push({
        stayDate: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
        },
      });
    } else if (query.year) {
      const range = jalaliYearRange(query.year);
      filters.push({ stayDate: { gte: range.gte, lt: range.lt } });
    }
    if (query.present !== undefined) {
      filters.push({ present: query.present });
    }
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.q) {
      const q = containsInsensitive(query.q);
      filters.push({
        OR: [
          { reservation: { code: q } },
          { reservation: { createdBy: { fullName: q } } },
          { reservation: { createdBy: { lastName: q } } },
          { reservation: { caravanManager: { fullName: q } } },
          { reservation: { caravanManager: { lastName: q } } },
          { reservation: { caravan: { name: q } } },
          { reservation: { group: { name: q } } },
          { reservation: { group: { manager: { fullName: q } } } },
          { walkingStation: { name: q } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private stayOrderBy(
    query: FindStationStaysQueryDto,
  ): Prisma.ReservationStationStayOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ReservationStationStayOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        stayDate: (dir) => ({ stayDate: dir }),
        reservedAt: (dir) => ({ reservedAt: dir }),
        maleCount: (dir) => ({ maleCount: dir }),
        femaleCount: (dir) => ({ femaleCount: dir }),
        present: (dir) => ({ present: dir }),
        status: (dir) => ({ status: dir }),
      },
      [{ stayDate: 'desc' }, { reservedAt: 'desc' }, { id: 'asc' }],
    );
  }

  private serializeStay(item: {
    id: string;
    stayDate: Date;
    mealType: string;
    maleCount: number;
    femaleCount: number;
    status: ReservationStationStayStatus;
    present: boolean;
    reservedAt: Date;
    cancelledAt: Date | null;
    evacuatedAt: Date | null;
    walkingStation?: { id: string; name: string };
    reservation: {
      id: string;
      code: string;
      type: string;
      status: string;
      year: number;
      walkingStartDate: Date | null;
      walkingRoute: { id: string; name: string } | null;
      caravan: { id: string; name: string } | null;
      group: {
        id: string;
        name: string;
        manager: {
          id: string;
          firstName: string;
          lastName: string;
          fullName: string;
        } | null;
      } | null;
      createdBy: {
        id: string;
        firstName: string;
        lastName: string;
        fullName: string;
      };
      caravanManager: {
        id: string;
        firstName: string;
        lastName: string;
        fullName: string;
      } | null;
    };
    reservedBy: { id: string; fullName: string };
    cancelledBy: { id: string; fullName: string } | null;
    evacuatedBy: { id: string; fullName: string } | null;
  }) {
    const reservation = item.reservation;
    const person =
      reservation.type === 'CARAVAN'
        ? reservation.caravanManager ?? reservation.createdBy
        : reservation.type === 'GROUP'
          ? reservation.group?.manager ?? reservation.createdBy
          : reservation.createdBy;
    return {
      id: item.id,
      stayDate: item.stayDate.toISOString().slice(0, 10),
      mealType: item.mealType,
      maleCount: item.maleCount,
      femaleCount: item.femaleCount,
      status: item.status,
      present: item.present,
      reservedAt: item.reservedAt.toISOString(),
      cancelledAt: item.cancelledAt?.toISOString() ?? null,
      evacuatedAt: item.evacuatedAt?.toISOString() ?? null,
      station: item.walkingStation ?? null,
      reservation: {
        id: reservation.id,
        code: reservation.code,
        type: reservation.type,
        status: reservation.status,
        year: reservation.year,
        walkingStartDate: reservation.walkingStartDate
          ? reservation.walkingStartDate.toISOString().slice(0, 10)
          : null,
        walkingRoute: reservation.walkingRoute,
        caravan: reservation.caravan,
        group: reservation.group,
        createdBy: reservation.createdBy,
        caravanManager: reservation.caravanManager,
        person,
        partyName: reservation.caravan?.name ?? reservation.group?.name ?? null,
      },
      reservedBy: item.reservedBy,
      cancelledBy: item.cancelledBy,
      evacuatedBy: item.evacuatedBy,
    };
  }

  private async managerFields(
    managerUserId: string | null | undefined,
    partial: boolean,
  ) {
    if (managerUserId === undefined) {
      return partial
        ? {}
        : {
            managerUserId: null,
            managerName: null,
            managerPhone: null,
            managerTelegram: null,
            managerWhatsapp: null,
            managerEitaa: null,
          };
    }
    if (!managerUserId) {
      return {
        managerUserId: null,
        managerName: null,
        managerPhone: null,
        managerTelegram: null,
        managerWhatsapp: null,
        managerEitaa: null,
      };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        telegram: true,
        whatsapp: true,
        eitaa: true,
      },
    });
    if (!user) {
      throw new BadRequestException('مسئول ایستگاه معتبر نیست');
    }
    return {
      managerUserId: user.id,
      managerName: user.fullName,
      managerPhone: user.phone,
      managerTelegram: user.telegram,
      managerWhatsapp: user.whatsapp,
      managerEitaa: user.eitaa,
    };
  }

  private async occupancyByStation(ids: string[]) {
    const map = new Map<string, { male: number; female: number }>();
    if (!ids.length) return map;
    const rows = await this.prisma.reservationStationStay.groupBy({
      by: ['walkingStationId'],
      where: {
        walkingStationId: { in: ids },
        status: ReservationStationStayStatus.RESERVED,
      },
      _sum: { maleCount: true, femaleCount: true },
    });
    for (const row of rows) {
      const stationId = String(row.walkingStationId);
      map.set(stationId, {
        male: row._sum.maleCount ?? 0,
        female: row._sum.femaleCount ?? 0,
      });
    }
    return map;
  }

  private serialize(
    item: WalkingStationRecord,
    occupied: { male: number; female: number } = { male: 0, female: 0 },
  ) {
    const num = (value: Prisma.Decimal | null) =>
      value == null ? null : Number(value);
    return {
      id: item.id,
      cityId: item.cityId,
      city: {
        ...item.city,
        latitude: num(item.city.latitude),
        longitude: num(item.city.longitude),
      },
      name: item.name,
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      address: item.address,
      neshanAddress: item.neshanAddress,
      maleCount: item.maleCount,
      femaleCount: item.femaleCount,
      occupiedMaleCount: occupied.male,
      occupiedFemaleCount: occupied.female,
      managerUserId: item.managerUserId,
      managerName: item.managerName,
      managerPhone: item.managerPhone,
      managerTelegram: item.managerTelegram,
      managerWhatsapp: item.managerWhatsapp,
      managerEitaa: item.managerEitaa,
      distanceToMashhadKm: num(item.distanceToMashhadKm),
      description: item.description,
      hasLaundry: item.hasLaundry,
      hasInternet: item.hasInternet,
      hasPrayerRoom: item.hasPrayerRoom,
      hasElevator: item.hasElevator,
      heatingSystem: item.heatingSystem,
      coolingSystem: item.coolingSystem,
      parkingCapacity: item.parkingCapacity,
      bathroomCount: item.bathroomCount,
      toiletCount: item.toiletCount,
      areaSqm: num(item.areaSqm),
      routes: item.routeStages.map((row) => ({
        id: row.walkingRoute.id,
        name: row.walkingRoute.name,
        stageNumber: row.stageNumber,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
