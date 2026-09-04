import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin, type RoleBearer } from '../auth/roles.util';
import { buildStyledExcelExport } from '../common/excel-export';
import {
  eachIsoDateInclusive,
  parseIsoDate,
  todayIsoDateTehran,
  toIsoDateOnly,
} from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  AllocationSource,
  AllocationStatus,
  PlacementMode,
  PlacementStatus,
  Prisma,
  ReservationStatus,
  UserGender,
  type PlacementGenderPolicy,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AllocatePlacementDto } from './dto/allocate-placement.dto';
import { AllocateSystemDto } from './dto/allocate-system.dto';
import { FindPlacementDueQueryDto } from './dto/find-placement-due-query.dto';
import { FindPlacementQueueQueryDto } from './dto/find-placement-queue-query.dto';
import { PlacementAvailabilityQueryDto } from './dto/placement-availability-query.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { runSystemAllocation } from './placement-algorithm';
import {
  addOccupancy,
  canShareVenueByPolicy,
  effectiveCapacity,
  isGenderOverride,
  placementStatusFromCounts,
  remainingForStay,
  venueCapacityFor,
  type OccupancyMap,
  type PlacementGender,
} from './placement-capacity';

type Actor = RoleBearer & { id: string };
type Db = Prisma.TransactionClient | PrismaService;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  nationalId: true,
  phone: true,
  gender: true,
  birthDate: true,
  status: true,
} satisfies Prisma.UserSelect;

const partySelect = {
  id: true,
  name: true,
  managerUserId: true,
  maleCount: true,
  femaleCount: true,
  totalCount: true,
} satisfies Prisma.CaravanSelect;

const allocationInclude = {
  accommodation: {
    select: {
      id: true,
      name: true,
      genderType: true,
      maleCapacity: true,
      femaleCapacity: true,
      overflowPercent: true,
      status: true,
      phone: true,
      address: true,
      neshanAddress: true,
      latitude: true,
      longitude: true,
      distanceToShrineKm: true,
      eitaa: true,
      bale: true,
      otherSocial: true,
      managers: {
        orderBy: [
          { year: 'desc' as const },
          { isPrimary: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
  },
  placedBy: { select: userSelect },
  vacatedBy: { select: userSelect },
} satisfies Prisma.ReservationAllocationInclude;

const queueInclude = {
  originCity: {
    select: { id: true, nameFa: true, nameEn: true, provinceId: true },
  },
  caravan: { select: partySelect },
  group: { select: partySelect },
  createdBy: { select: userSelect },
  caravanManager: { select: userSelect },
  allocations: {
    where: { status: AllocationStatus.ACTIVE },
    select: { gender: true, headcount: true },
  },
} satisfies Prisma.ReservationInclude;

@Injectable()
export class PlacementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findQueue(query: FindPlacementQueueQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const where = this.queueWhere(query);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const orderBy = this.queueOrder(query);
    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: queueInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeQueueItem(item)),
      total,
      page,
      pageSize,
    );
  }

  async exportQueue(query: FindPlacementQueueQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const where = this.queueWhere(query);
    const items = await this.prisma.reservation.findMany({
      where,
      include: queueInclude,
      orderBy: this.queueOrder(query),
    });
    return buildStyledExcelExport({
      sheetName: 'جانمایی',
      columns: [
        { header: 'کد پرونده', key: 'code', width: 14 },
        { header: 'نوع', key: 'type', width: 12 },
        { header: 'نام کاروان', key: 'caravanName', width: 32 },
        { header: 'مدیر کاروان', key: 'caravanManager', width: 28 },
        { header: 'مرد', key: 'maleCount', width: 10 },
        { header: 'زن', key: 'femaleCount', width: 10 },
        { header: 'تخصیص مرد', key: 'allocatedMale', width: 12 },
        { header: 'تخصیص زن', key: 'allocatedFemale', width: 12 },
        { header: 'شروع اقامت', key: 'stayStartDate', width: 14 },
        { header: 'پایان اقامت', key: 'stayEndDate', width: 14 },
        { header: 'وضعیت', key: 'placementStatus', width: 16 },
      ],
      rows: items.map((item) => {
        const row = this.serializeQueueItem(item);
        return {
          code: row.code,
          type: row.type,
          caravanName: row.caravan?.name ?? '',
          caravanManager: row.caravanManager?.fullName ?? '',
          maleCount: row.maleCount,
          femaleCount: row.femaleCount,
          allocatedMale: row.allocatedMale,
          allocatedFemale: row.allocatedFemale,
          stayStartDate: row.stayStartDate ?? '',
          stayEndDate: row.stayEndDate ?? '',
          placementStatus: row.placementStatus,
        };
      }),
    });
  }

  async findDue(query: FindPlacementDueQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const today = todayIsoDateTehran();
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where: Prisma.ReservationAllocationWhereInput = {
      status: AllocationStatus.ACTIVE,
      reservation: {
        stayEndDate: { lt: parseIsoDate(today) },
        ...(query.q?.trim()
          ? {
              OR: [
                { code: containsInsensitive(query.q.trim()) },
                { caravan: { name: containsInsensitive(query.q.trim()) } },
                { group: { name: containsInsensitive(query.q.trim()) } },
              ],
            }
          : {}),
      },
    };
    const orderBy = resolveSortOrder<Prisma.ReservationAllocationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        stayEndDate: (dir) => ({ reservation: { stayEndDate: dir } }),
        gender: (dir) => ({ gender: dir }),
        headcount: (dir) => ({ headcount: dir }),
        placedAt: (dir) => ({ placedAt: dir }),
        party: (dir) => [
          { reservation: { caravan: { name: dir } } },
          { reservation: { group: { name: dir } } },
        ],
      },
      [{ reservation: { stayEndDate: 'asc' } }, { id: 'asc' }],
    );
    const [items, total] = await Promise.all([
      this.prisma.reservationAllocation.findMany({
        where,
        include: {
          ...allocationInclude,
          reservation: {
            select: {
              id: true,
              code: true,
              type: true,
              year: true,
              stayStartDate: true,
              stayEndDate: true,
              caravan: { select: { id: true, name: true } },
              group: { select: { id: true, name: true } },
              createdBy: { select: userSelect },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.reservationAllocation.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeDueItem(item)),
      total,
      page,
      pageSize,
    );
  }

  async getReservation(id: string, actor: Actor) {
    this.assertAdmin(actor);
    const row = await this.requireQueueReservation(id);
    const settings = await this.prisma.receptionSettings.findUnique({
      where: { year: row.year },
      select: { placementGenderPolicy: true },
    });
    const occupancy = await this.occupancyForStay(
      toIsoDateOnly(row.stayStartDate) ?? todayIsoDateTehran(),
      toIsoDateOnly(row.stayEndDate) ?? todayIsoDateTehran(),
    );
    const allocated = this.allocatedTotals(row.allocations);
    return {
      ...this.serializeQueueItem(row),
      placementGenderPolicy:
        settings?.placementGenderPolicy ?? ('SINGLE_GENDER' as const),
      allocations: row.allocations.map((item) =>
        this.serializeAllocation(item, occupancy, row),
      ),
      allocatedMale: allocated.male,
      allocatedFemale: allocated.female,
    };
  }

  async availability(query: PlacementAvailabilityQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    if (query.stayStartDate > query.stayEndDate) {
      throw new BadRequestException('بازهٔ اقامت معتبر نیست');
    }
    const occupancy = await this.occupancyForStay(
      query.stayStartDate,
      query.stayEndDate,
    );
    const sharing = query.reservationId
      ? await this.sharingForReservation(query.reservationId)
      : new Map<string, Set<PlacementGender>>();
    const venues = await this.prisma.accommodation.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        genderType: true,
        maleCapacity: true,
        femaleCapacity: true,
        overflowPercent: true,
        status: true,
      },
    });
    return venues.map((venue) => {
      const remainingMale = remainingForStay(
        occupancy,
        venue.id,
        'MALE',
        query.stayStartDate,
        query.stayEndDate,
        venue.maleCapacity,
        venue.overflowPercent,
      );
      const remainingFemale = remainingForStay(
        occupancy,
        venue.id,
        'FEMALE',
        query.stayStartDate,
        query.stayEndDate,
        venue.femaleCapacity,
        venue.overflowPercent,
      );
      const remainingNominalMale = remainingForStay(
        occupancy,
        venue.id,
        'MALE',
        query.stayStartDate,
        query.stayEndDate,
        venue.maleCapacity,
        0,
      );
      const remainingNominalFemale = remainingForStay(
        occupancy,
        venue.id,
        'FEMALE',
        query.stayStartDate,
        query.stayEndDate,
        venue.femaleCapacity,
        0,
      );
      return {
        id: venue.id,
        name: venue.name,
        genderType: venue.genderType,
        maleCapacity: venue.maleCapacity,
        femaleCapacity: venue.femaleCapacity,
        overflowPercent: venue.overflowPercent,
        effectiveMale: effectiveCapacity(
          venue.maleCapacity,
          venue.overflowPercent,
        ),
        effectiveFemale: effectiveCapacity(
          venue.femaleCapacity,
          venue.overflowPercent,
        ),
        remainingMale,
        remainingFemale,
        remainingNominalMale,
        remainingNominalFemale,
        otherGenders: [...(sharing.get(venue.id) ?? [])],
      };
    });
  }

  async allocateManual(dto: AllocatePlacementDto, actor: Actor) {
    this.assertAdmin(actor);
    const reservationId = await this.prisma.$transaction(async (tx) => {
      const current = await this.requireAllocatable(tx, dto.reservationId);
      for (const item of dto.items) {
        await this.createAllocation(tx, current, item, actor, AllocationSource.MANUAL);
      }
      await this.applyAccommodatedCounts(tx, current.id, dto.items);
      await this.syncReservationPlacement(tx, current.id, actor.id);
      await this.syncAssigned(
        tx,
        dto.items.map((item) => item.accommodationId),
      );
      return current.id;
    });
    return this.getReservation(reservationId, actor);
  }

  async allocateSystem(dto: AllocateSystemDto, actor: Actor) {
    this.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const where = this.queueWhere({
        ...dto,
        placementMode: PlacementMode.SYSTEM,
        placementStatus: dto.placementStatus,
      });
      const systemWhere: Prisma.ReservationWhereInput = {
        ...where,
        placementMode: PlacementMode.SYSTEM,
        placementStatus: {
          in: [PlacementStatus.PENDING, PlacementStatus.PARTIAL],
        },
        stayStartDate: { not: null },
        stayEndDate: { not: null },
        ...(dto.ids?.length ? { id: { in: dto.ids } } : {}),
      };
      const reservations = await tx.reservation.findMany({
        where: systemWhere,
        include: {
          ...queueInclude,
          allocations: {
            where: { status: AllocationStatus.ACTIVE },
            include: allocationInclude,
          },
        },
      });
      const settingsByYear = new Map<number, PlacementGenderPolicy>();
      const years = [...new Set(reservations.map((item) => item.year))];
      if (years.length) {
        const settings = await tx.receptionSettings.findMany({
          where: { year: { in: years } },
          select: { year: true, placementGenderPolicy: true },
        });
        for (const row of settings) {
          settingsByYear.set(row.year, row.placementGenderPolicy);
        }
      }
      const venues = await tx.accommodation.findMany({
        where: { status: 'ACTIVE' },
      });
      const occupants = await this.loadActiveOccupants(tx);
      const planned = runSystemAllocation({
        reservations: reservations.map((item) => {
          const allocated = this.allocatedTotals(item.allocations);
          return {
            id: item.id,
            maleCount: item.maleCount,
            femaleCount: item.femaleCount,
            totalCount: item.totalCount,
            stayStartDate: toIsoDateOnly(item.stayStartDate) ?? '',
            stayEndDate: toIsoDateOnly(item.stayEndDate) ?? '',
            allocatedMale: allocated.male,
            allocatedFemale: allocated.female,
            policy: settingsByYear.get(item.year) ?? 'SINGLE_GENDER',
            placementMode: item.placementMode,
          };
        }),
        accommodations: venues.map((item) => ({
          id: item.id,
          status: item.status,
          genderType: item.genderType,
          maleCapacity: item.maleCapacity,
          femaleCapacity: item.femaleCapacity,
          overflowPercent: item.overflowPercent,
        })),
        occupants,
      });

      const touched = new Set<string>();
      for (const item of planned) {
        const reservation = reservations.find((row) => row.id === item.reservationId);
        if (!reservation) continue;
        await this.createAllocation(
          tx,
          reservation,
          {
            accommodationId: item.accommodationId,
            gender: item.gender,
            headcount: item.headcount,
          },
          actor,
          AllocationSource.SYSTEM,
          { skipManualOverride: true },
        );
        touched.add(item.accommodationId);
        await this.syncReservationPlacement(tx, item.reservationId, actor.id);
      }

      await this.syncAssigned(tx, [...touched]);
      return {
        created: planned.length,
        reservationIds: [...new Set(planned.map((item) => item.reservationId))],
      };
    });
  }

  async updateAllocation(id: string, dto: UpdateAllocationDto, actor: Actor) {
    this.assertAdmin(actor);
    const reservationId = await this.prisma.$transaction(async (tx) => {
      const current = await tx.reservationAllocation.findUnique({
        where: { id },
        include: { reservation: { include: queueInclude }, ...allocationInclude },
      });
      if (!current || current.status !== AllocationStatus.ACTIVE) {
        throw new NotFoundException('تخصیص فعال یافت نشد');
      }
      await this.vacateRow(tx, current.id, actor.id);
      const next = await this.createAllocation(
        tx,
        current.reservation,
        {
          accommodationId: dto.accommodationId ?? current.accommodationId,
          gender: dto.gender ?? current.gender,
          headcount: dto.headcount ?? current.headcount,
          genderOverride: dto.genderOverride,
          overrideNote: dto.overrideNote,
          notes: dto.notes ?? current.notes ?? undefined,
        },
        actor,
        AllocationSource.HYBRID,
      );
      await this.applyAccommodatedCounts(tx, current.reservationId, [
        {
          gender: dto.gender ?? current.gender,
          accommodatedCount: dto.accommodatedCount,
        },
      ]);
      await this.syncReservationPlacement(tx, current.reservationId, actor.id);
      await this.syncAssigned(tx, [
        current.accommodationId,
        next.accommodationId,
      ]);
      return current.reservationId;
    });
    return this.getReservation(reservationId, actor);
  }

  async vacateAllocation(id: string, actor: Actor) {
    this.assertAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.reservationAllocation.findUnique({
        where: { id },
      });
      if (!current || current.status !== AllocationStatus.ACTIVE) {
        throw new NotFoundException('تخصیص فعال یافت نشد');
      }
      await this.vacateRow(tx, current.id, actor.id);
      await this.syncReservationPlacement(tx, current.reservationId, actor.id);
      await this.syncAssigned(tx, [current.accommodationId]);
      return { vacated: 1 };
    });
  }

  async vacateDue(actor: Actor | null) {
    const today = todayIsoDateTehran();
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.reservationAllocation.findMany({
        where: {
          status: AllocationStatus.ACTIVE,
          reservation: { stayEndDate: { lt: parseIsoDate(today) } },
        },
        select: { id: true, accommodationId: true, reservationId: true },
      });
      const accIds = [...new Set(due.map((item) => item.accommodationId))];
      const reservationIds = [...new Set(due.map((item) => item.reservationId))];
      if (due.length) {
        await tx.reservationAllocation.updateMany({
          where: { id: { in: due.map((item) => item.id) } },
          data: {
            status: AllocationStatus.VACATED,
            vacatedAt: new Date(),
            vacatedById: actor?.id ?? null,
          },
        });
      }
      for (const reservationId of reservationIds) {
        await this.syncReservationPlacement(tx, reservationId, actor?.id ?? null);
      }
      await this.syncAssigned(tx, accIds);
      return { vacated: due.length };
    });
  }

  async vacateActiveForReservation(
    tx: Db,
    reservationId: string,
    actorId: string | null,
  ) {
    const active = await tx.reservationAllocation.findMany({
      where: { reservationId, status: AllocationStatus.ACTIVE },
      select: { id: true, accommodationId: true },
    });
    if (!active.length) return;
    await tx.reservationAllocation.updateMany({
      where: { id: { in: active.map((item) => item.id) } },
      data: {
        status: AllocationStatus.VACATED,
        vacatedAt: new Date(),
        vacatedById: actorId,
      },
    });
    await this.syncAssigned(
      tx,
      active.map((item) => item.accommodationId),
    );
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
  }

  private queueWhere(query: FindPlacementQueueQueryDto): Prisma.ReservationWhereInput {
    const term = query.q?.trim();
    return {
      status: ReservationStatus.COMPLETED,
      requestsAccommodation: true,
      placementStatus: query.placementStatus
        ? query.placementStatus
        : { in: [PlacementStatus.PENDING, PlacementStatus.PARTIAL, PlacementStatus.PLACED] },
      ...(query.year ? { year: query.year } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.placementMode ? { placementMode: query.placementMode } : {}),
      ...(query.caravanId ? { caravanId: query.caravanId } : {}),
      ...(term
        ? {
            OR: [
              { code: containsInsensitive(term) },
              { caravan: { name: containsInsensitive(term) } },
              { group: { name: containsInsensitive(term) } },
              { createdBy: { fullName: containsInsensitive(term) } },
            ],
          }
        : {}),
    };
  }

  private queueOrder(query: FindPlacementQueueQueryDto) {
    return resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        year: (dir) => ({ year: dir }),
        type: (dir) => ({ type: dir }),
        placementStatus: (dir) => ({ placementStatus: dir }),
        placementMode: (dir) => ({ placementMode: dir }),
        stayStartDate: (dir) => ({ stayStartDate: dir }),
        stayEndDate: (dir) => ({ stayEndDate: dir }),
        totalCount: (dir) => ({ totalCount: dir }),
        maleCount: (dir) => ({ maleCount: dir }),
        femaleCount: (dir) => ({ femaleCount: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
        party: (dir) => ({ caravan: { name: dir } }),
        caravanManager: (dir) => ({ caravanManager: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private allocatedTotals(
    allocations: { gender: UserGender; headcount: number; status?: AllocationStatus }[],
  ) {
    return allocations
      .filter((item) => item.status !== AllocationStatus.VACATED)
      .reduce(
        (sum, item) => {
          if (item.gender === UserGender.MALE) sum.male += item.headcount;
          if (item.gender === UserGender.FEMALE) sum.female += item.headcount;
          return sum;
        },
        { male: 0, female: 0 },
      );
  }

  private partyName(row: {
    caravan?: { name: string } | null;
    group?: { name: string } | null;
    createdBy?: { fullName: string } | null;
    code: string;
  }) {
    return row.caravan?.name || row.group?.name || row.createdBy?.fullName || row.code;
  }

  private serializeQueueItem(
    row: Prisma.ReservationGetPayload<{ include: typeof queueInclude }>,
  ) {
    const allocated = this.allocatedTotals(row.allocations);
    return {
      id: row.id,
      code: row.code,
      year: row.year,
      type: row.type,
      status: row.status,
      placementMode: row.placementMode,
      placementStatus: row.placementStatus,
      stayStartDate: toIsoDateOnly(row.stayStartDate),
      stayEndDate: toIsoDateOnly(row.stayEndDate),
      maleCount: row.maleCount,
      femaleCount: row.femaleCount,
      totalCount: row.totalCount,
      accommodatedMaleCount: row.accommodatedMaleCount,
      accommodatedFemaleCount: row.accommodatedFemaleCount,
      allocatedMale: allocated.male,
      allocatedFemale: allocated.female,
      partyName: this.partyName(row),
      caravan: row.caravan,
      group: row.group,
      createdBy: row.createdBy,
      caravanManager: row.caravanManager,
      originCity: row.originCity,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private serializeDueItem(
    item: Prisma.ReservationAllocationGetPayload<{
      include: typeof allocationInclude & {
        reservation: {
          select: {
            id: true;
            code: true;
            type: true;
            year: true;
            stayStartDate: true;
            stayEndDate: true;
            caravan: { select: { id: true; name: true } };
            group: { select: { id: true; name: true } };
            createdBy: { select: typeof userSelect };
          };
        };
      };
    }>,
  ) {
    return {
      id: item.id,
      gender: item.gender,
      headcount: item.headcount,
      source: item.source,
      placedAt: item.placedAt.toISOString(),
      accommodation: {
        id: item.accommodation.id,
        name: item.accommodation.name,
        genderType: item.accommodation.genderType,
      },
      reservation: {
        id: item.reservation.id,
        code: item.reservation.code,
        type: item.reservation.type,
        year: item.reservation.year,
        stayStartDate: toIsoDateOnly(item.reservation.stayStartDate),
        stayEndDate: toIsoDateOnly(item.reservation.stayEndDate),
        partyName: this.partyName(item.reservation),
      },
    };
  }

  private serializeStayAccommodation(
    item: Prisma.ReservationAllocationGetPayload<{
      include: typeof allocationInclude;
    }>['accommodation'],
  ) {
    const num = (value: Prisma.Decimal | null) =>
      value == null ? null : Number(value);
    return {
      id: item.id,
      name: item.name,
      genderType: item.genderType,
      phone: item.phone,
      address: item.address,
      neshanAddress: item.neshanAddress,
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      distanceToShrineKm: num(item.distanceToShrineKm),
      eitaa: item.eitaa,
      bale: item.bale,
      otherSocial: item.otherSocial,
      managers: item.managers,
    };
  }

  private serializeAllocation(
    item: Prisma.ReservationAllocationGetPayload<{ include: typeof allocationInclude }>,
    occupancy: OccupancyMap,
    reservation: { stayStartDate: Date | null; stayEndDate: Date | null },
  ) {
    const start = toIsoDateOnly(reservation.stayStartDate);
    const end = toIsoDateOnly(reservation.stayEndDate);
    const remainingNominal =
      start && end
        ? remainingForStay(
            occupancy,
            item.accommodationId,
            item.gender,
            start,
            end,
            venueCapacityFor(item.accommodation, item.gender),
            0,
          )
        : 0;
    return {
      id: item.id,
      accommodationId: item.accommodationId,
      accommodation: this.serializeStayAccommodation(item.accommodation),
      gender: item.gender,
      headcount: item.headcount,
      status: item.status,
      source: item.source,
      genderOverride: item.genderOverride,
      overrideNote: item.overrideNote,
      notes: item.notes,
      placedAt: item.placedAt.toISOString(),
      placedBy: item.placedBy,
      usesOverflow: remainingNominal < 0,
    };
  }

  private async requireQueueReservation(id: string, tx: Db = this.prisma) {
    const row = await tx.reservation.findUnique({
      where: { id },
      include: {
        ...queueInclude,
        allocations: {
          where: { status: AllocationStatus.ACTIVE },
          include: allocationInclude,
          orderBy: { placedAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('پرونده یافت نشد');
    return row;
  }

  private async requireAllocatable(tx: Db, id: string) {
    const row = await this.requireQueueReservation(id, tx);
    if (row.status !== ReservationStatus.COMPLETED) {
      throw new BadRequestException('فقط پرونده تکمیل‌شده قابل جانمایی است');
    }
    if (!row.requestsAccommodation) {
      throw new BadRequestException('این پرونده متقاضی اسکان نیست');
    }
    if (!row.stayStartDate || !row.stayEndDate) {
      throw new BadRequestException('تاریخ اقامت پرونده کامل نیست');
    }
    return row;
  }

  private async occupancyForStay(start: string, end: string, tx: Db = this.prisma) {
    const rows = await tx.reservationAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        reservation: {
          stayStartDate: { lte: parseIsoDate(end) },
          stayEndDate: { gte: parseIsoDate(start) },
        },
      },
      include: {
        reservation: { select: { stayStartDate: true, stayEndDate: true } },
      },
    });
    const occupancy: OccupancyMap = new Map();
    for (const row of rows) {
      const stayStart = toIsoDateOnly(row.reservation.stayStartDate);
      const stayEnd = toIsoDateOnly(row.reservation.stayEndDate);
      if (!stayStart || !stayEnd) continue;
      addOccupancy(
        occupancy,
        row.accommodationId,
        row.gender,
        eachIsoDateInclusive(stayStart, stayEnd),
        row.headcount,
      );
    }
    return occupancy;
  }

  private async sharingForReservation(reservationId: string) {
    const rows = await this.prisma.reservationAllocation.findMany({
      where: { reservationId, status: AllocationStatus.ACTIVE },
      select: { accommodationId: true, gender: true },
    });
    const map = new Map<string, Set<PlacementGender>>();
    for (const row of rows) {
      const current = map.get(row.accommodationId) ?? new Set<PlacementGender>();
      current.add(row.gender);
      map.set(row.accommodationId, current);
    }
    return map;
  }

  private async loadActiveOccupants(tx: Db): Promise<
    {
      reservationId: string;
      accommodationId: string;
      gender: PlacementGender;
      headcount: number;
      stayStartDate: string;
      stayEndDate: string;
    }[]
  > {
    const rows = await tx.reservationAllocation.findMany({
      where: { status: AllocationStatus.ACTIVE },
      include: {
        reservation: { select: { stayStartDate: true, stayEndDate: true } },
      },
    });
    return rows.flatMap((row) => {
      const stayStartDate = toIsoDateOnly(row.reservation.stayStartDate);
      const stayEndDate = toIsoDateOnly(row.reservation.stayEndDate);
      if (!stayStartDate || !stayEndDate) return [];
      return [
        {
          reservationId: row.reservationId,
          accommodationId: row.accommodationId,
          gender: row.gender,
          headcount: row.headcount,
          stayStartDate,
          stayEndDate,
        },
      ];
    });
  }

  private async createAllocation(
    tx: Db,
    reservation: Prisma.ReservationGetPayload<{ include: typeof queueInclude }>,
    item: {
      accommodationId: string;
      gender: UserGender;
      headcount: number;
      genderOverride?: boolean;
      overrideNote?: string;
      notes?: string;
    },
    actor: Actor,
    source: AllocationSource,
    options?: { skipManualOverride?: boolean },
  ) {
    if (item.gender !== UserGender.MALE && item.gender !== UserGender.FEMALE) {
      throw new BadRequestException('جنسیت تخصیص معتبر نیست');
    }
    const stayStart = toIsoDateOnly(reservation.stayStartDate);
    const stayEnd = toIsoDateOnly(reservation.stayEndDate);
    if (!stayStart || !stayEnd) {
      throw new BadRequestException('تاریخ اقامت پرونده کامل نیست');
    }
    const venue = await tx.accommodation.findUnique({
      where: { id: item.accommodationId },
    });
    if (!venue || venue.status === 'INACTIVE') {
      throw new BadRequestException('اسکان انتخاب‌شده معتبر نیست');
    }
    const settings = await tx.receptionSettings.findUnique({
      where: { year: reservation.year },
      select: { placementGenderPolicy: true },
    });
    const policy = settings?.placementGenderPolicy ?? 'SINGLE_GENDER';
    const genderMismatch = isGenderOverride(venue.genderType, item.gender);
    const existing = await tx.reservationAllocation.findMany({
      where: {
        reservationId: reservation.id,
        status: AllocationStatus.ACTIVE,
      },
      select: { accommodationId: true, gender: true, headcount: true },
    });
    const otherGenderHere = existing.some(
      (row) =>
        row.accommodationId === item.accommodationId && row.gender !== item.gender,
    );
    const policyConflict =
      otherGenderHere && !canShareVenueByPolicy(policy, venue);
    const needsOverride = genderMismatch || policyConflict;
    if (options?.skipManualOverride && needsOverride) {
      throw new BadRequestException('تخصیص سیستمی این ترکیب جنسیت را نمی‌پذیرد');
    }
    if (needsOverride) {
      if (!item.genderOverride || !item.overrideNote?.trim()) {
        throw new BadRequestException(
          'برای این تخصیص تأیید استثنا و یادداشت دلیل لازم است',
        );
      }
    }
    if (!options?.skipManualOverride && genderMismatch && !item.genderOverride) {
      throw new BadRequestException('جنسیت اسکان با تخصیص هم‌خوان نیست');
    }

    const allocated = this.allocatedTotals(existing);
    const nextMale =
      allocated.male + (item.gender === UserGender.MALE ? item.headcount : 0);
    const nextFemale =
      allocated.female + (item.gender === UserGender.FEMALE ? item.headcount : 0);
    if (nextMale > reservation.maleCount) {
      throw new BadRequestException(
        'تعداد آقایان نمی‌تواند بیشتر از مقدار تعریف‌شده در پرونده باشد',
      );
    }
    if (nextFemale > reservation.femaleCount) {
      throw new BadRequestException(
        'تعداد خانم‌ها نمی‌تواند بیشتر از مقدار تعریف‌شده در پرونده باشد',
      );
    }

    const occupancy = await this.occupancyForStay(stayStart, stayEnd, tx);
    const remaining = remainingForStay(
      occupancy,
      venue.id,
      item.gender,
      stayStart,
      stayEnd,
      venueCapacityFor(venue, item.gender),
      venue.overflowPercent,
    );
    if (item.headcount > remaining) {
      throw new BadRequestException(
        'گنجایش باقی‌مانده این اسکان در بازهٔ اقامت کافی نیست',
      );
    }

    return tx.reservationAllocation.create({
      data: {
        reservationId: reservation.id,
        accommodationId: venue.id,
        gender: item.gender,
        headcount: item.headcount,
        status: AllocationStatus.ACTIVE,
        source,
        genderOverride: Boolean(needsOverride && item.genderOverride),
        overrideNote: item.overrideNote?.trim() || null,
        notes: item.notes?.trim() || null,
        placedById: actor.id,
      },
      include: allocationInclude,
    });
  }

  private async vacateRow(tx: Db, id: string, actorId: string | null) {
    await tx.reservationAllocation.update({
      where: { id },
      data: {
        status: AllocationStatus.VACATED,
        vacatedAt: new Date(),
        vacatedById: actorId,
      },
    });
  }

  private async applyAccommodatedCounts(
    tx: Db,
    reservationId: string,
    items: { gender: UserGender; accommodatedCount?: number }[],
  ) {
    const data: Prisma.ReservationUpdateInput = {};
    for (const item of items) {
      if (item.accommodatedCount == null) continue;
      if (item.gender === UserGender.MALE) {
        data.accommodatedMaleCount = item.accommodatedCount;
      }
      if (item.gender === UserGender.FEMALE) {
        data.accommodatedFemaleCount = item.accommodatedCount;
      }
    }
    if (Object.keys(data).length === 0) return;
    await tx.reservation.update({
      where: { id: reservationId },
      data,
    });
  }

  private async syncReservationPlacement(
    tx: Db,
    reservationId: string,
    actorId: string | null,
  ) {
    const row = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        allocations: {
          where: { status: AllocationStatus.ACTIVE },
          select: { gender: true, headcount: true },
        },
      },
    });
    if (!row) return;
    const allocated = this.allocatedTotals(row.allocations);
    const status = placementStatusFromCounts({
      requestsAccommodation: row.requestsAccommodation,
      maleCount: row.maleCount,
      femaleCount: row.femaleCount,
      allocatedMale: allocated.male,
      allocatedFemale: allocated.female,
    });
    const placed = status === 'PLACED';
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        placementStatus: status,
        placementCompletedAt: placed
          ? (row.placementCompletedAt ?? new Date())
          : null,
        placementCompletedById: placed
          ? (row.placementCompletedById ?? actorId)
          : null,
      },
    });
  }

  private async syncAssigned(tx: Db, accommodationIds: string[]) {
    const ids = [...new Set(accommodationIds.filter(Boolean))];
    if (!ids.length) return;
    const today = todayIsoDateTehran();
    const rows = await tx.reservationAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        accommodationId: { in: ids },
        reservation: {
          stayStartDate: { lte: parseIsoDate(today) },
          stayEndDate: { gte: parseIsoDate(today) },
        },
      },
      select: { accommodationId: true, gender: true, headcount: true },
    });
    const totals = new Map<string, { male: number; female: number }>();
    for (const id of ids) {
      totals.set(id, { male: 0, female: 0 });
    }
    for (const row of rows) {
      const current = totals.get(row.accommodationId) ?? { male: 0, female: 0 };
      if (row.gender === UserGender.MALE) current.male += row.headcount;
      if (row.gender === UserGender.FEMALE) current.female += row.headcount;
      totals.set(row.accommodationId, current);
    }
    for (const [id, value] of totals) {
      await tx.accommodation.update({
        where: { id },
        data: {
          assignedMaleCapacity: value.male,
          assignedFemaleCapacity: value.female,
        },
      });
    }
  }
}
