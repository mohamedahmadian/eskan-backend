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
import { Prisma, ReservationStationStayStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalkingStationDto } from './dto/create-walking-station.dto';
import { FindWalkingStationsQueryDto } from './dto/find-walking-stations-query.dto';
import { UpdateWalkingStationDto } from './dto/update-walking-station.dto';

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

@Injectable()
export class WalkingStationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindWalkingStationsQueryDto) {
    const where = this.listWhere(query);
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

  async findOne(id: string) {
    const item = await this.prisma.walkingStation.findUnique({
      where: { id },
      include: walkingStationInclude,
    });
    if (!item) {
      throw new NotFoundException('ایستگاه یافت نشد');
    }
    const occupied = await this.occupancyByStation([id]);
    return this.serialize(item, occupied.get(id) ?? { male: 0, female: 0 });
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

  async listStays(id: string) {
    await this.findOne(id);
    const items = await this.prisma.reservationStationStay.findMany({
      where: { walkingStationId: id },
      orderBy: [{ stayDate: 'desc' }, { reservedAt: 'desc' }],
      include: {
        reservation: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            year: true,
          },
        },
        reservedBy: { select: { id: true, fullName: true } },
        cancelledBy: { select: { id: true, fullName: true } },
        evacuatedBy: { select: { id: true, fullName: true } },
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        stayDate: item.stayDate.toISOString().slice(0, 10),
        maleCount: item.maleCount,
        femaleCount: item.femaleCount,
        status: item.status,
        reservedAt: item.reservedAt.toISOString(),
        cancelledAt: item.cancelledAt?.toISOString() ?? null,
        evacuatedAt: item.evacuatedAt?.toISOString() ?? null,
        reservation: item.reservation,
        reservedBy: item.reservedBy,
        cancelledBy: item.cancelledBy,
        evacuatedBy: item.evacuatedBy,
      })),
    };
  }

  async evacuate(id: string, actorId: string) {
    await this.findOne(id);
    const now = new Date();
    const result = await this.prisma.reservationStationStay.updateMany({
      where: {
        walkingStationId: id,
        status: ReservationStationStayStatus.RESERVED,
      },
      data: {
        status: ReservationStationStayStatus.EVACUATED,
        evacuatedAt: now,
        evacuatedById: actorId,
      },
    });
    return { ok: true, count: result.count };
  }

  async create(dto: CreateWalkingStationDto) {
    const city = await this.assertIranCity(dto.cityId);
    this.assertCoords(dto.latitude, dto.longitude);
    const item = await this.prisma.walkingStation.create({
      data: this.stationData(dto, city.id),
      include: walkingStationInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateWalkingStationDto) {
    const current = await this.findOne(id);
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
      data: this.stationData(dto, cityId, true),
      include: walkingStationInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    const used = await this.prisma.walkingRouteStage.count({
      where: { walkingStationId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'این ایستگاه در مسیر پیاده استفاده شده و قابل حذف نیست',
      );
    }
    await this.prisma.walkingStation.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindWalkingStationsQueryDto,
  ): Prisma.WalkingStationWhereInput {
    const filters: Prisma.WalkingStationWhereInput[] = [];
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

  private stationData(
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
      managerName:
        dto.managerName === undefined
          ? undefined
          : dto.managerName?.trim() || null,
      managerPhone:
        dto.managerPhone === undefined
          ? undefined
          : dto.managerPhone?.trim() || null,
      managerTelegram:
        dto.managerTelegram === undefined
          ? undefined
          : dto.managerTelegram?.trim() || null,
      managerWhatsapp:
        dto.managerWhatsapp === undefined
          ? undefined
          : dto.managerWhatsapp?.trim() || null,
      managerEitaa:
        dto.managerEitaa === undefined
          ? undefined
          : dto.managerEitaa?.trim() || null,
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
