import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  isAdmin,
  isCaravanManager,
  isPilgrim,
  type RoleBearer,
} from '../auth/roles.util';
import { parseIsoDate, parseOptionalIsoDate, todayIsoDateTehran } from '../common/iso-date';
import { toLatinDigits } from '../common/national-id';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  CaravanContactRole,
  Prisma,
  ReceptionSettings,
  ReservationMemberInsuranceStatus,
  ReservationStatus,
  ReservationType,
  UserGender,
} from '../generated/prisma/client';
import { buildStyledExcelExport } from '../common/excel-export';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AddReservationMemberDto } from './dto/add-reservation-member.dto';
import {
  parseReservationMemberExcel,
  type ParsedMemberImportRow,
} from './reservation-member-excel';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';
import { SetReservationContactDto } from './dto/set-reservation-contact.dto';
import { UpdateMemberInsuranceDto } from './dto/update-member-insurance.dto';
import { UpdateReceptionSettingsDto } from './dto/update-reception-settings.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
  assertCapacity,
  occupiedCounts,
  remainingCapacity,
} from './reservation-capacity';
import {
  CARAVAN_CONTACT_ROLES,
  IN_PROGRESS_FILTER,
  IN_PROGRESS_STATUSES,
  isOccupyingStatus,
  nextAfterBasicInfo,
  nextAfterCompanions,
  nextAfterManagement,
  settingsAutoApproveKey,
  settingsCapacityKeys,
  settingsEnabledKey,
  validReturnStatuses,
} from './reservation-workflow';
import { SYSTEM_USERNAME } from './system-user';

type Actor = RoleBearer & { id: string };
type Tx = Prisma.TransactionClient;

const INSURANCE_OK: ReservationMemberInsuranceStatus[] = [
  ReservationMemberInsuranceStatus.PAID,
  ReservationMemberInsuranceStatus.APPROVED,
];

const INSURANCE_PAYABLE: ReservationMemberInsuranceStatus[] = [
  ReservationMemberInsuranceStatus.PENDING,
  ReservationMemberInsuranceStatus.REJECTED,
];

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

const reservationInclude = {
  originCity: {
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
      province: { select: { id: true, nameFa: true, nameEn: true } },
    },
  },
  walkingRoute: { select: { id: true, name: true } },
  caravan: {
    select: { id: true, name: true, managerUserId: true },
  },
  createdBy: { select: userSelect },
  caravanManager: { select: userSelect },
  basicInfoCompletedBy: { select: userSelect },
  managementReviewedBy: { select: userSelect },
  companionsCompletedBy: { select: userSelect },
  caravanContactsCompletedBy: { select: userSelect },
  insuranceCompletedBy: { select: userSelect },
  completedBy: { select: userSelect },
  rejectedBy: { select: userSelect },
  cancelledBy: { select: userSelect },
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: userSelect } },
  },
  caravanContacts: {
    orderBy: { role: 'asc' as const },
    include: { user: { select: userSelect } },
  },
} satisfies Prisma.ReservationInclude;

type ReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

const LOCKED_FIELDS = [
  'type',
  'year',
  'originCityId',
  'walkingRouteId',
  'stayStartDate',
  'stayEndDate',
  'walkingStartDate',
  'maleCount',
  'femaleCount',
] as const;

const GROUP_MAX_SIZE = 20;

const emptySettings = (year: number) => ({
  year,
  exists: false,
  individualEnabled: false,
  individualMaleCapacity: 0,
  individualFemaleCapacity: 0,
  individualAutoApprove: false,
  groupEnabled: false,
  groupMaleCapacity: 0,
  groupFemaleCapacity: 0,
  groupAutoApprove: false,
  caravanEnabled: false,
  caravanMaleCapacity: 0,
  caravanFemaleCapacity: 0,
  caravanAutoApprove: false,
  insuranceOrganization: '',
  insurancePremiumAmount: 0,
  insuranceCoverage: '',
});

function serializeSettings(row: ReceptionSettings, exists = true) {
  return {
    year: row.year,
    exists,
    individualEnabled: row.individualEnabled,
    individualMaleCapacity: row.individualMaleCapacity,
    individualFemaleCapacity: row.individualFemaleCapacity,
    individualAutoApprove: row.individualAutoApprove,
    groupEnabled: row.groupEnabled,
    groupMaleCapacity: row.groupMaleCapacity,
    groupFemaleCapacity: row.groupFemaleCapacity,
    groupAutoApprove: row.groupAutoApprove,
    caravanEnabled: row.caravanEnabled,
    caravanMaleCapacity: row.caravanMaleCapacity,
    caravanFemaleCapacity: row.caravanFemaleCapacity,
    caravanAutoApprove: row.caravanAutoApprove,
    insuranceOrganization: row.insuranceOrganization ?? '',
    insurancePremiumAmount: row.insurancePremiumAmount ?? 0,
    insuranceCoverage: row.insuranceCoverage ?? '',
  };
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async getSettings(year: number) {
    this.assertYear(year);
    const row = await this.prisma.receptionSettings.findUnique({
      where: { year },
    });
    if (!row) return emptySettings(year);
    return serializeSettings(row);
  }

  async upsertSettings(year: number, dto: UpdateReceptionSettingsDto) {
    this.assertYear(year);
    const types: ReservationType[] = [
      ReservationType.INDIVIDUAL,
      ReservationType.GROUP,
      ReservationType.CARAVAN,
    ];
    for (const type of types) {
      const used = await occupiedCounts(this.prisma, year, type);
      const keys = settingsCapacityKeys(type);
      if (dto[keys.male] < used.male || dto[keys.female] < used.female) {
        throw new BadRequestException(
          'ظرفیت جدید کمتر از ظرفیت مصرف‌شده فعلی است.',
        );
      }
    }
    const row = await this.prisma.receptionSettings.upsert({
      where: { year },
      create: { year, ...dto },
      update: dto,
    });
    return serializeSettings(row);
  }

  async getDashboard(year: number, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    this.assertYear(year);
    const capacity = await this.getCapacity(year);
    const [byStatus, byType] = await Promise.all([
      this.prisma.reservation.groupBy({
        by: ['status'],
        where: { year },
        _count: { _all: true },
      }),
      this.prisma.reservation.groupBy({
        by: ['type'],
        where: { year },
        _count: { _all: true },
        _sum: { maleCount: true, femaleCount: true, totalCount: true },
      }),
    ]);

    const statusCount = (status: ReservationStatus) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    const typeSlice = (type: ReservationType) => {
      const row = byType.find((item) => item.type === type);
      return {
        reservations: row?._count._all ?? 0,
        maleCount: row?._sum.maleCount ?? 0,
        femaleCount: row?._sum.femaleCount ?? 0,
        totalCount: row?._sum.totalCount ?? 0,
      };
    };

    const pendingReview = statusCount(ReservationStatus.PENDING_MANAGEMENT_REVIEW);
    const completed = statusCount(ReservationStatus.COMPLETED);
    const rejected = statusCount(ReservationStatus.REJECTED);
    const cancelled = statusCount(ReservationStatus.CANCELLED);
    const inProgress =
      statusCount(ReservationStatus.DRAFT) +
      statusCount(ReservationStatus.COMPANIONS) +
      statusCount(ReservationStatus.CARAVAN_CONTACTS) +
      statusCount(ReservationStatus.INSURANCE);

    return {
      year,
      totals: {
        all: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        pendingReview,
        inProgress,
        completed,
        rejected,
        cancelled,
      },
      progress: {
        draft: statusCount(ReservationStatus.DRAFT),
        companions: statusCount(ReservationStatus.COMPANIONS),
        contacts: statusCount(ReservationStatus.CARAVAN_CONTACTS),
        insurance: statusCount(ReservationStatus.INSURANCE),
      },
      types: {
        individual: typeSlice(ReservationType.INDIVIDUAL),
        group: typeSlice(ReservationType.GROUP),
        caravan: typeSlice(ReservationType.CARAVAN),
      },
      capacity,
    };
  }

  async getCapacity(year: number) {
    this.assertYear(year);
    const settings = await this.prisma.receptionSettings.findUnique({
      where: { year },
    });
    if (!settings) {
      return {
        year,
        exists: false,
        individual: remainingCapacity(
          emptySettings(year) as unknown as ReceptionSettings,
          ReservationType.INDIVIDUAL,
          { male: 0, female: 0 },
        ),
        group: remainingCapacity(
          emptySettings(year) as unknown as ReceptionSettings,
          ReservationType.GROUP,
          { male: 0, female: 0 },
        ),
        caravan: remainingCapacity(
          emptySettings(year) as unknown as ReceptionSettings,
          ReservationType.CARAVAN,
          { male: 0, female: 0 },
        ),
      };
    }

    const [individual, group, caravan] = await Promise.all([
      occupiedCounts(this.prisma, year, ReservationType.INDIVIDUAL),
      occupiedCounts(this.prisma, year, ReservationType.GROUP),
      occupiedCounts(this.prisma, year, ReservationType.CARAVAN),
    ]);

    return {
      year,
      exists: true,
      individual: remainingCapacity(settings, ReservationType.INDIVIDUAL, individual),
      group: remainingCapacity(settings, ReservationType.GROUP, group),
      caravan: remainingCapacity(settings, ReservationType.CARAVAN, caravan),
    };
  }

  async create(dto: CreateReservationDto, actor: Actor) {
    this.assertCounts(dto.maleCount, dto.femaleCount);
    this.assertGroupSize(dto.type, dto.maleCount, dto.femaleCount);
    this.assertTripDates(dto.walkingStartDate, dto.stayStartDate, dto.stayEndDate);
    await this.assertTypeEnabled(dto.year, dto.type);
    if (dto.originCityId) await this.assertOriginCity(dto.originCityId);
    await this.assertWalkingRoute(dto.walkingRouteId);

    const caravan = await this.resolveCaravan(dto, actor);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          createdById: actor.id,
          year: dto.year,
          type: dto.type,
          status: ReservationStatus.DRAFT,
          originCityId: dto.originCityId ?? null,
          walkingRouteId: dto.walkingRouteId ?? null,
          stayStartDate: parseIsoDate(dto.stayStartDate),
          stayEndDate: parseIsoDate(dto.stayEndDate),
          walkingStartDate: parseOptionalIsoDate(dto.walkingStartDate) ?? null,
          maleCount: dto.maleCount,
          femaleCount: dto.femaleCount,
          totalCount: dto.maleCount + dto.femaleCount,
          caravanId: caravan?.id ?? null,
          caravanManagerId: caravan?.managerUserId ?? null,
        },
        include: reservationInclude,
      });
      return this.submitDraft(tx, created, actor);
    });
  }

  async update(id: string, dto: UpdateReservationDto, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.status !== ReservationStatus.DRAFT) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (current.basicInfoLockedAt) {
      throw new BadRequestException('پرونده قفل است');
    }
    this.assertNoLockedFieldChange(dto, Boolean(current.basicInfoLockedAt));

    const type = dto.type ?? current.type;
    const year = dto.year ?? current.year;
    const maleCount = dto.maleCount ?? current.maleCount;
    const femaleCount = dto.femaleCount ?? current.femaleCount;
    this.assertCounts(maleCount, femaleCount);
    this.assertGroupSize(type, maleCount, femaleCount);

    const walkingStart =
      dto.walkingStartDate !== undefined
        ? dto.walkingStartDate
        : toDateOnly(current.walkingStartDate);
    const stayStart =
      dto.stayStartDate !== undefined
        ? dto.stayStartDate
        : toDateOnly(current.stayStartDate);
    const stayEnd =
      dto.stayEndDate !== undefined
        ? dto.stayEndDate
        : toDateOnly(current.stayEndDate);
    this.assertTripDates(
      walkingStart,
      stayStart,
      stayEnd,
      toDateOnly(current.walkingStartDate),
    );

    if (dto.type || dto.year) {
      await this.assertTypeEnabled(year, type);
    }
    if (dto.originCityId) await this.assertOriginCity(dto.originCityId);
    if (dto.walkingRouteId !== undefined) {
      await this.assertWalkingRoute(dto.walkingRouteId);
    }

    const caravan = await this.resolveCaravan(
      {
        type,
        caravanId: dto.caravanId === undefined ? current.caravanId : dto.caravanId,
        caravanManagerId:
          dto.caravanManagerId === undefined
            ? current.caravanManagerId
            : dto.caravanManagerId,
      },
      actor,
    );

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        type,
        year,
        originCityId:
          dto.originCityId === undefined ? undefined : dto.originCityId,
        walkingRouteId:
          dto.walkingRouteId === undefined ? undefined : dto.walkingRouteId,
        stayStartDate: parseOptionalIsoDate(dto.stayStartDate),
        stayEndDate: parseOptionalIsoDate(dto.stayEndDate),
        walkingStartDate: parseOptionalIsoDate(dto.walkingStartDate),
        maleCount,
        femaleCount,
        totalCount: maleCount + femaleCount,
        caravanId: type === ReservationType.CARAVAN ? (caravan?.id ?? null) : null,
        caravanManagerId:
          type === ReservationType.CARAVAN ? (caravan?.managerUserId ?? null) : null,
        caravanManagerNotes:
          dto.caravanManagerNotes === undefined
            ? undefined
            : dto.caravanManagerNotes?.trim() || null,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  async submit(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      return this.submitDraft(tx, current, actor);
    });
  }

  async approve(id: string, actor: Actor, notes?: string | null) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      if (current.status !== ReservationStatus.PENDING_MANAGEMENT_REVIEW) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }
      const settings = await this.requireSettings(current.year, tx);
      await assertCapacity(
        tx,
        settings,
        current.type,
        current.year,
        current.maleCount,
        current.femaleCount,
        current.id,
      );

      if (current.type === ReservationType.INDIVIDUAL) {
        await this.ensureApplicantMember(tx, current);
      }

      const now = new Date();
      const trimmedNotes = notes?.trim();
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status: nextAfterManagement(current.type),
          managementReviewedAt: now,
          managementReviewedById: actor.id,
          basicInfoLockedAt: now,
          managementNotes: trimmedNotes ? trimmedNotes : current.managementNotes,
        },
        include: reservationInclude,
      });
      return this.serialize(updated, actor);
    });
  }

  async reject(id: string, reason: string, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    if (
      current.status === ReservationStatus.REJECTED ||
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.REJECTED,
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
        rejectedById: actor.id,
      },
      include: reservationInclude,
    });
    this.emitWorkflowEvent('reject', id, actor.id);
    return this.serialize(updated, actor);
  }

  async returnTo(id: string, status: ReservationStatus, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('فقط مدیریت می‌تواند پرونده ردشده را بازگرداند');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      if (current.status !== ReservationStatus.REJECTED) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }
      const allowed = validReturnStatuses(current.type);
      if (!allowed.includes(status)) {
        throw new BadRequestException('مرحله مقصد برای این نوع پذیرش معتبر نیست');
      }

      if (isOccupyingStatus(status)) {
        const settings = await this.requireSettings(current.year, tx);
        await assertCapacity(
          tx,
          settings,
          current.type,
          current.year,
          current.maleCount,
          current.femaleCount,
          current.id,
        );
      }

      const clearAfter = this.clearAfterReturn(status);
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status,
          returnedToStatus: status,
          rejectedAt: null,
          rejectedById: null,
          rejectionReason: null,
          ...clearAfter,
        } satisfies Prisma.ReservationUncheckedUpdateInput,
        include: reservationInclude,
      });
      this.emitWorkflowEvent('return', id, actor.id);
      return this.serialize(updated, actor);
    });
  }

  async cancel(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: actor.id,
      },
      include: reservationInclude,
    });
    this.emitWorkflowEvent('cancel', id, actor.id);
    return this.serialize(updated, actor);
  }

  async findAll(query: FindReservationsQueryDto, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.list(query);
  }

  async findMine(query: FindReservationsQueryDto, actor: Actor) {
    return this.list(query, {
      OR: [
        { createdById: actor.id },
        { caravanManagerId: actor.id },
        { members: { some: { userId: actor.id } } },
      ],
    });
  }

  async getMineHome(actor: Actor) {
    const showPilgrim = isPilgrim(actor);
    const showManager = isCaravanManager(actor);
    const [pilgrim, caravanManager] = await Promise.all([
      showPilgrim ? this.buildPilgrimHome(actor.id) : Promise.resolve(null),
      showManager ? this.buildCaravanManagerHome(actor.id) : Promise.resolve(null),
    ]);
    return { pilgrim, caravanManager };
  }

  private pilgrimHomeWhere(userId: string): Prisma.ReservationWhereInput {
    return {
      OR: [
        {
          createdById: userId,
          type: { in: [ReservationType.INDIVIDUAL, ReservationType.GROUP] },
        },
        { members: { some: { userId } } },
      ],
    };
  }

  private managerHomeWhere(userId: string): Prisma.ReservationWhereInput {
    return {
      OR: [
        { caravanManagerId: userId },
        { createdById: userId, type: ReservationType.CARAVAN },
      ],
    };
  }

  private summarizeStatuses(
    rows: Array<{ status: ReservationStatus; _count: { _all: number } }>,
  ) {
    const count = (status: ReservationStatus) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;
    const inProgress = IN_PROGRESS_STATUSES.reduce(
      (sum, status) => sum + count(status),
      0,
    );
    return {
      all: rows.reduce((sum, row) => sum + row._count._all, 0),
      inProgress,
      pendingReview: count(ReservationStatus.PENDING_MANAGEMENT_REVIEW),
      completed: count(ReservationStatus.COMPLETED),
    };
  }

  private async reservationStatusSummary(where: Prisma.ReservationWhereInput) {
    const rows = await this.prisma.reservation.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    return this.summarizeStatuses(rows);
  }

  private async recentReservations(where: Prisma.ReservationWhereInput) {
    const items = await this.prisma.reservation.findMany({
      where,
      include: reservationInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 5,
    });
    return items.map((item) => this.serializeListItem(item));
  }

  private async buildPilgrimHome(userId: string) {
    const where = this.pilgrimHomeWhere(userId);
    const [totals, recent] = await Promise.all([
      this.reservationStatusSummary(where),
      this.recentReservations(where),
    ]);
    return { totals, recent };
  }

  private async buildCaravanManagerHome(userId: string) {
    const where = this.managerHomeWhere(userId);
    const caravanWhere = { managerUserId: userId };
    const [totals, recentReservations, caravanCount, activeCaravanCount, recentCaravans] =
      await Promise.all([
        this.reservationStatusSummary(where),
        this.recentReservations(where),
        this.prisma.caravan.count({ where: caravanWhere }),
        this.prisma.caravan.count({ where: { ...caravanWhere, isActive: true } }),
        this.prisma.caravan.findMany({
          where: caravanWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 5,
          select: {
            id: true,
            name: true,
            isActive: true,
            city: {
              select: { id: true, nameFa: true, nameEn: true, provinceId: true },
            },
          },
        }),
      ]);
    return {
      caravanCount,
      activeCaravanCount,
      totals,
      recentCaravans,
      recentReservations,
    };
  }

  async findOne(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertCanView(current, actor);
    return this.serialize(current, actor);
  }

  async listMembers(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertCanView(current, actor);
    if (!this.canSeeMembers(current, actor)) {
      throw new ForbiddenException('دسترسی به فهرست اعضا مجاز نیست');
    }
    return current.members.map((item) => this.serializeMember(item));
  }

  async addMember(id: string, dto: AddReservationMemberDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      this.assertGroupOrCaravan(current);
      if (current.status !== ReservationStatus.COMPANIONS) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }

      const { user } = await this.resolveCompanion(dto);
      try {
        await tx.reservationMember.create({
          data: { reservationId: id, userId: user.id },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('کاربر قبلاً عضو این پرونده است');
        }
        throw error;
      }

      const updated = await this.requireReservation(id, tx);
      return this.serialize(updated, actor);
    });
  }

  async removeMember(id: string, memberId: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    if (current.status !== ReservationStatus.COMPANIONS) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    const member = current.members.find((item) => item.id === memberId);
    if (!member) {
      throw new NotFoundException('عضو پرونده یافت نشد');
    }
    await this.prisma.reservationMember.delete({ where: { id: memberId } });
    return this.serialize(await this.requireReservation(id), actor);
  }

  async getPreviousMembers(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertCaravan(current);
    this.assertCompanionsStatus(current);
    const previous = await this.findPreviousCaravanReservation(current);
    const currentIds = new Set(current.members.map((item) => item.userId));
    return {
      reservation: previous
        ? { id: previous.id, year: previous.year, type: previous.type }
        : null,
      members: (previous?.members ?? []).map((item) => ({
        userId: item.userId,
        alreadyMember: currentIds.has(item.userId),
        user: {
          ...item.user,
          birthDate: toDateOnly(item.user.birthDate),
        },
      })),
    };
  }

  async copyPreviousMembers(id: string, actor: Actor, userIds?: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      this.assertCaravan(current);
      this.assertCompanionsStatus(current);

      const previous = await this.findPreviousCaravanReservation(current, tx);
      if (!previous?.members.length) {
        throw new BadRequestException('پرونده کاروانی قبلی با عضو یافت نشد');
      }

      const previousIds = new Set(previous.members.map((item) => item.userId));
      if (userIds?.some((userId) => !previousIds.has(userId))) {
        throw new BadRequestException('بعضی از افراد انتخاب‌شده عضو پرونده سال قبل نیستند');
      }

      const existing = new Set(current.members.map((item) => item.userId));
      const wanted = previous.members.filter((item) =>
        userIds ? userIds.includes(item.userId) : true,
      );
      const toCreate = wanted.filter((item) => !existing.has(item.userId));
      this.assertRemainingForImport(
        current,
        toCreate.map((item) => item.user.gender),
      );

      if (toCreate.length) {
        await tx.reservationMember.createMany({
          data: toCreate.map((item) => ({
            reservationId: id,
            userId: item.userId,
          })),
          skipDuplicates: true,
        });
      }

      return this.serialize(await this.requireReservation(id, tx), actor);
    });
  }

  async memberImportTemplate(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertCompanionsStatus(current);
    return buildStyledExcelExport({
      sheetName: 'همراهان',
      columns: [
        { header: 'کد ملی', key: 'nationalId', width: 16 },
        { header: 'نام', key: 'firstName', width: 18 },
        { header: 'نام خانوادگی', key: 'lastName', width: 20 },
        { header: 'تلفن همراه', key: 'phone', width: 16 },
        { header: 'جنسیت', key: 'gender', width: 12 },
        { header: 'تاریخ تولد', key: 'birthDate', width: 16 },
      ],
      rows: [
        {
          nationalId: '0123456789',
          firstName: 'علی',
          lastName: 'احمدی',
          phone: '09123456789',
          gender: 'مرد',
          birthDate: '1370/1/15',
        },
      ],
    });
  }

  async previewMemberImport(id: string, buffer: Buffer, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertCompanionsStatus(current);
    return this.buildMemberImportPreview(current, buffer);
  }

  async exportMemberImportErrors(id: string, buffer: Buffer, actor: Actor) {
    const preview = await this.previewMemberImport(id, buffer, actor);
    const rows = preview.rows.filter(
      (row) => row.status === 'INVALID' || row.status === 'DUPLICATE',
    );
    return buildStyledExcelExport({
      sheetName: 'خطاها',
      columns: [
        { header: 'ردیف فایل', key: 'fileRow', width: 12 },
        { header: 'کد ملی', key: 'nationalId', width: 16 },
        { header: 'نام', key: 'firstName', width: 16 },
        { header: 'نام خانوادگی', key: 'lastName', width: 18 },
        { header: 'جنسیت', key: 'gender', width: 12 },
        { header: 'وضعیت', key: 'status', width: 16 },
        { header: 'خطا', key: 'errors', width: 40 },
      ],
      rows: rows.map((row) => ({
        fileRow: row.rowNumber,
        nationalId: row.nationalId,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.genderText,
        status: row.status === 'DUPLICATE' ? 'تکراری' : 'نامعتبر',
        errors: row.errors.map((code) => memberImportErrorLabel(code)).join('، '),
      })),
    });
  }

  async importMembers(
    id: string,
    buffer: Buffer,
    nationalIds: string[],
    actor: Actor,
  ) {
    const selectedIds = [...new Set(nationalIds.filter(Boolean))];
    if (!selectedIds.length) {
      throw new BadRequestException('هیچ ردیفی برای ثبت انتخاب نشده است');
    }

    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertCompanionsStatus(current);

    const preview = await this.buildMemberImportPreview(current, buffer);
    const byNationalId = new Map(preview.rows.map((row) => [row.nationalId, row]));
    const selected = selectedIds.map((nationalId) => {
      const row = byNationalId.get(nationalId);
      if (!row) {
        throw new BadRequestException(`کد ملی ${nationalId} در فایل نیست`);
      }
      if (row.status !== 'VALID' || row.userState === 'ALREADY_MEMBER') {
        throw new BadRequestException(`ردیف ${row.rowNumber} برای ثبت آماده نیست`);
      }
      return row;
    });

    this.assertRemainingForImport(
      current,
      selected.map((row) => row.gender),
    );

    const resolved = [];
    for (const row of selected) {
      resolved.push(
        await this.resolveCompanion({
          nationalId: row.nationalId,
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender ?? undefined,
          phone: row.phone || null,
          birthDate: row.birthDate,
        }),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const fresh = await this.requireReservation(id, tx);
      this.assertCompanionsStatus(fresh);
      this.assertRemainingForImport(
        fresh,
        resolved.map((item) => item.user.gender),
      );
      await tx.reservationMember.createMany({
        data: resolved.map((item) => ({
          reservationId: id,
          userId: item.user.id,
        })),
        skipDuplicates: true,
      });
      return this.serialize(await this.requireReservation(id, tx), actor);
    });
  }

  async completeCompanions(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    if (current.status !== ReservationStatus.COMPANIONS) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }

    const males = current.members.filter((item) => item.user.gender === UserGender.MALE);
    const females = current.members.filter(
      (item) => item.user.gender === UserGender.FEMALE,
    );
    if (current.members.some((item) => !item.user.gender)) {
      throw new BadRequestException('جنسیت همه اعضا باید مشخص باشد');
    }
    if (males.length !== current.maleCount || females.length !== current.femaleCount) {
      throw new BadRequestException(
        'تعداد اعضای مرد و زن با تعداد اعلام‌شده پرونده سازگار نیست',
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: nextAfterCompanions(current.type),
        companionsCompletedAt: new Date(),
        companionsCompletedById: actor.id,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  async listContacts(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertCanView(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    if (!this.canSeeMembers(current, actor)) {
      return [];
    }
    return current.caravanContacts.map((item) => this.serializeContact(item));
  }

  async setContact(id: string, dto: SetReservationContactDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      if (current.type !== ReservationType.CARAVAN) {
        throw new BadRequestException('این پرونده کاروانی نیست');
      }
      if (current.status !== ReservationStatus.CARAVAN_CONTACTS) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }

      const { user } = await this.resolveCompanion(
        {
          nationalId: dto.nationalId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          birthDate: dto.birthDate,
        },
        { requireGender: false },
      );

      await tx.reservationCaravanContact.upsert({
        where: {
          reservationId_role: { reservationId: id, role: dto.role },
        },
        create: { reservationId: id, role: dto.role, userId: user.id },
        update: { userId: user.id },
      });

      return this.serialize(await this.requireReservation(id, tx), actor);
    });
  }

  async completeContacts(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    if (current.status !== ReservationStatus.CARAVAN_CONTACTS) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    const roles = new Set(current.caravanContacts.map((item) => item.role));
    const missing = CARAVAN_CONTACT_ROLES.filter(
      (role) => !roles.has(role as CaravanContactRole),
    );
    if (missing.length) {
      throw new BadRequestException('همه رابطین کاروان باید تعیین شوند');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.INSURANCE,
        caravanContactsCompletedAt: new Date(),
        caravanContactsCompletedById: actor.id,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  async updateMemberInsurance(
    id: string,
    memberId: string,
    dto: UpdateMemberInsuranceDto,
    actor: Actor,
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    if (current.status !== ReservationStatus.INSURANCE) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    const member = current.members.find((item) => item.id === memberId);
    if (!member) {
      throw new NotFoundException('عضو پرونده یافت نشد');
    }
    if (
      dto.status === ReservationMemberInsuranceStatus.REJECTED &&
      !dto.note?.trim()
    ) {
      throw new BadRequestException('علت رد را وارد کنید');
    }

    const now = new Date();
    const accepted =
      dto.status === ReservationMemberInsuranceStatus.PAID ||
      dto.status === ReservationMemberInsuranceStatus.APPROVED;
    const settings = accepted
      ? await this.prisma.receptionSettings.findUnique({
          where: { year: current.year },
        })
      : null;
    await this.prisma.reservationMember.update({
      where: { id: memberId },
      data: {
        insuranceStatus: dto.status,
        insuranceManualNote: dto.note?.trim() || null,
        insurancePaidAt: accepted ? (member.insurancePaidAt ?? now) : null,
        insurancePaidAmount: accepted
          ? (member.insurancePaidAmount ?? settings?.insurancePremiumAmount ?? 0)
          : null,
        insuranceVerifiedAt:
          dto.status === ReservationMemberInsuranceStatus.APPROVED ? now : null,
        insuranceVerifiedById:
          dto.status === ReservationMemberInsuranceStatus.APPROVED ? actor.id : null,
      },
    });
    const updated = await this.requireReservation(id);
    if (this.isReadyToComplete(updated)) {
      return this.complete(id, actor);
    }
    return this.serialize(updated, actor);
  }

  async getInsurance(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    return this.summarizeInsurance(current.members);
  }

  async payInsurance(id: string, memberIds: string[], actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      if (current.status !== ReservationStatus.INSURANCE) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }
      await this.markMembersPaid(tx, current, memberIds);
      const afterPay = await this.requireReservation(id, tx);
      if (this.isReadyToComplete(afterPay)) {
        return this.finishReservation(tx, afterPay, actor);
      }
      return this.serialize(afterPay, actor);
    });
  }

  async complete(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      this.assertCanComplete(current);
      return this.finishReservation(tx, current, actor);
    });
  }

  async completeInsurance(id: string, actor: Actor) {
    return this.complete(id, actor);
  }

  private async list(
    query: FindReservationsQueryDto,
    extraWhere?: Prisma.ReservationWhereInput,
  ) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const filters: Prisma.ReservationWhereInput[] = [];
    if (extraWhere) filters.push(extraWhere);
    if (query.year) filters.push({ year: query.year });
    if (query.type) filters.push({ type: query.type });
    if (query.status === IN_PROGRESS_FILTER) {
      filters.push({ status: { in: IN_PROGRESS_STATUSES } });
    } else if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.walkingRouteId) filters.push({ walkingRouteId: query.walkingRouteId });
    if (query.originCityId) filters.push({ originCityId: query.originCityId });
    if (query.caravanManagerId) {
      filters.push({ caravanManagerId: query.caravanManagerId });
    }
    if (query.createdFrom || query.createdTo) {
      filters.push({
        createdAt: {
          ...(query.createdFrom ? { gte: parseIsoDate(query.createdFrom) } : {}),
          ...(query.createdTo
            ? {
                lt: new Date(
                  parseIsoDate(query.createdTo).getTime() + 24 * 60 * 60 * 1000,
                ),
              }
            : {}),
        },
      });
    }
    if (query.q) {
      const search: Prisma.ReservationWhereInput[] = [
        { createdBy: { fullName: containsInsensitive(query.q) } },
        { createdBy: { nationalId: containsInsensitive(query.q) } },
        { originCity: { nameFa: containsInsensitive(query.q) } },
        { caravan: { name: containsInsensitive(query.q) } },
      ];
      if (isReservationId(query.q)) search.unshift({ id: query.q.trim() });
      const searchYear = parseSearchYear(query.q);
      if (searchYear) search.push({ year: searchYear });
      const searchType = matchSearchType(query.q);
      if (searchType) search.push({ type: searchType });
      filters.push({ OR: search });
    }
    const where = filters.length ? { AND: filters } : {};
    const orderBy = resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        year: (dir) => ({ year: dir }),
        type: (dir) => ({ type: dir }),
        status: (dir) => ({ status: dir }),
        stayStartDate: (dir) => ({ stayStartDate: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
        updatedAt: (dir) => ({ updatedAt: dir }),
        totalCount: (dir) => ({ totalCount: dir }),
        originCity: (dir) => ({ originCity: { nameFa: dir } }),
        createdBy: (dir) => ({ createdBy: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeListItem(item)),
      total,
      page,
      pageSize,
    );
  }

  private async requireReservation(id: string, tx: Tx | PrismaService = this.prisma) {
    const row = await tx.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });
    if (!row) {
      throw new NotFoundException('پرونده زیارتی یافت نشد');
    }
    return row;
  }

  private async requireSettings(year: number, tx: Tx) {
    const settings = await tx.receptionSettings.findUnique({ where: { year } });
    if (!settings) {
      throw new BadRequestException('تنظیمات پذیرش این سال تعریف نشده است');
    }
    return settings;
  }

  private async assertTypeEnabled(year: number, type: ReservationType) {
    const settings = await this.prisma.receptionSettings.findUnique({
      where: { year },
    });
    if (!settings || !settings[settingsEnabledKey(type)]) {
      throw new BadRequestException('پذیرش این نوع در این سال فعال نیست');
    }
  }

  private async assertOriginCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      throw new BadRequestException('شهر مبدأ معتبر نیست');
    }
  }

  private async assertWalkingRoute(routeId?: string | null) {
    if (!routeId) return;
    const route = await this.prisma.walkingRoute.findUnique({
      where: { id: routeId },
    });
    if (!route) {
      throw new BadRequestException('مسیر ورودی معتبر نیست');
    }
  }

  private async resolveCaravan(
    dto: {
      type: ReservationType;
      caravanId?: string | null;
      caravanManagerId?: string | null;
    },
    actor: Actor,
  ) {
    if (dto.type !== ReservationType.CARAVAN) {
      if (dto.caravanId) {
        throw new BadRequestException('این پرونده کاروانی نیست');
      }
      return null;
    }
    if (!dto.caravanId) {
      return null;
    }
    const caravan = await this.prisma.caravan.findUnique({
      where: { id: dto.caravanId },
    });
    if (!caravan) {
      throw new BadRequestException('کاروان انتخاب‌شده معتبر نیست');
    }
    if (
      !isAdmin(actor) &&
      caravan.managerUserId &&
      caravan.managerUserId !== actor.id &&
      dto.caravanId
    ) {
      if (caravan.managerUserId !== actor.id) {
        throw new ForbiddenException('امکان استفاده از این کاروان وجود ندارد');
      }
    }
    const managerUserId = isAdmin(actor)
      ? (dto.caravanManagerId ?? caravan.managerUserId)
      : (caravan.managerUserId ?? actor.id);
    return { id: caravan.id, managerUserId };
  }

  private async submitDraft(tx: Tx, current: ReservationRecord, actor: Actor) {
    this.assertOwnerOrAdmin(current, actor);
    if (current.status !== ReservationStatus.DRAFT) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (current.basicInfoLockedAt) {
      throw new BadRequestException('پرونده قفل است');
    }
    this.assertCounts(current.maleCount, current.femaleCount);
    this.assertTripDates(
      toDateOnly(current.walkingStartDate),
      toDateOnly(current.stayStartDate),
      toDateOnly(current.stayEndDate),
      toDateOnly(current.walkingStartDate),
    );
    if (current.type === ReservationType.CARAVAN && !current.caravanId) {
      throw new BadRequestException('این پرونده کاروانی نیست یا کاروان انتخاب نشده است');
    }

    const settings = await this.requireSettings(current.year, tx);
    if (!settings[settingsEnabledKey(current.type)]) {
      throw new BadRequestException('پذیرش این نوع در این سال فعال نیست');
    }

    const autoApprove = settings[settingsAutoApproveKey(current.type)];
    const next = nextAfterBasicInfo(current.type, autoApprove);
    const now = new Date();
    const systemUserId = autoApprove ? await this.systemUserId(tx) : null;

    if (autoApprove) {
      await assertCapacity(
        tx,
        settings,
        current.type,
        current.year,
        current.maleCount,
        current.femaleCount,
        current.id,
      );
    }

    if (current.type === ReservationType.INDIVIDUAL) {
      await this.ensureApplicantMember(tx, current);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: next,
        basicInfoCompletedAt: now,
        basicInfoCompletedById: actor.id,
        ...(autoApprove
          ? {
              managementReviewedAt: now,
              managementReviewedById: systemUserId,
              basicInfoLockedAt: now,
            }
          : {}),
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  private async ensureApplicantMember(
    tx: Tx,
    reservation: Pick<ReservationRecord, 'id' | 'createdById' | 'members'>,
  ) {
    if (reservation.members.some((item) => item.userId === reservation.createdById)) {
      return;
    }
    await tx.reservationMember.create({
      data: {
        reservationId: reservation.id,
        userId: reservation.createdById,
      },
    });
  }

  private async resolveCompanion(
    dto: AddReservationMemberDto,
    options?: { requireGender?: boolean },
  ) {
    const existing = await this.users.findByIdentity({ nationalId: dto.nationalId });
    if (existing.found) {
      return { user: existing.user };
    }
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('نام و نام خانوادگی همراه لازم است');
    }
    if (options?.requireGender !== false && !dto.gender) {
      throw new BadRequestException('جنسیت همراه لازم است');
    }
    return this.users.findOrCreatePilgrim({
      nationalId: dto.nationalId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      phone: dto.phone,
      birthDate: dto.birthDate,
    });
  }

  private async systemUserId(tx: Tx) {
    const user = await tx.user.findUnique({
      where: { username: SYSTEM_USERNAME },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('کاربر سیستمی تعریف نشده است');
    }
    return user.id;
  }

  private assertYear(year: number) {
    if (!Number.isInteger(year) || year < 1300 || year > 1600) {
      throw new BadRequestException('سال پذیرش معتبر نیست');
    }
  }

  private assertCounts(maleCount: number, femaleCount: number) {
    if (maleCount < 0 || femaleCount < 0 || maleCount + femaleCount <= 0) {
      throw new BadRequestException('تعداد مرد و زن باید معتبر باشد');
    }
  }

  private assertGroupSize(type: ReservationType, maleCount: number, femaleCount: number) {
    if (type === ReservationType.GROUP && maleCount + femaleCount > GROUP_MAX_SIZE) {
      throw new BadRequestException(`ظرفیت گروه حداکثر ${GROUP_MAX_SIZE} نفر است`);
    }
  }

  private assertTripDates(
    walkingStart?: string | null,
    stayStart?: string | null,
    stayEnd?: string | null,
    existingWalkingStart?: string | null,
  ) {
    if (!stayStart) {
      throw new BadRequestException('تاریخ رسیدن به مشهد مقدس را وارد کنید');
    }
    if (!stayEnd) {
      throw new BadRequestException('تاریخ پایان اقامت را وارد کنید');
    }
    if (
      walkingStart &&
      walkingStart < todayIsoDateTehran() &&
      walkingStart !== existingWalkingStart
    ) {
      throw new BadRequestException(
        'تاریخ شروع پیاده‌روی نمی‌تواند قبل از امروز باشد',
      );
    }
    if (walkingStart && stayStart && stayStart <= walkingStart) {
      throw new BadRequestException(
        'تاریخ شروع پیاده‌روی باید قبل از تاریخ رسیدن به مشهد باشد',
      );
    }
    if (stayStart && stayEnd && stayEnd < stayStart) {
      throw new BadRequestException(
        'تاریخ پایان اقامت نمی‌تواند قبل از رسیدن به مشهد باشد',
      );
    }
  }

  private assertNoLockedFieldChange(
    dto: UpdateReservationDto,
    locked = false,
  ) {
    if (!locked) return;
    for (const field of LOCKED_FIELDS) {
      if (dto[field] !== undefined) {
        throw new BadRequestException('پرونده قفل است');
      }
    }
  }

  private summarizeInsurance(members: ReservationRecord['members']) {
    const pending = members.filter(
      (item) => item.insuranceStatus === ReservationMemberInsuranceStatus.PENDING,
    ).length;
    const paid = members.filter(
      (item) => item.insuranceStatus === ReservationMemberInsuranceStatus.PAID,
    ).length;
    const approved = members.filter(
      (item) => item.insuranceStatus === ReservationMemberInsuranceStatus.APPROVED,
    ).length;
    const rejected = members.filter(
      (item) => item.insuranceStatus === ReservationMemberInsuranceStatus.REJECTED,
    ).length;
    return {
      total: members.length,
      pending,
      paid,
      approved,
      rejected,
      completed: members.length > 0 && pending === 0 && rejected === 0,
    };
  }

  private async markMembersPaid(
    tx: Tx,
    reservation: ReservationRecord,
    memberIds: string[],
  ) {
    const uniqueIds = [...new Set(memberIds)];
    const payable = uniqueIds.map((memberId) => {
      const member = reservation.members.find((item) => item.id === memberId);
      if (!member) {
        throw new NotFoundException('عضو پرونده یافت نشد');
      }
      return member;
    }).filter((member) => INSURANCE_PAYABLE.includes(member.insuranceStatus));

    if (!payable.length) {
      throw new BadRequestException('عضوی برای پرداخت بیمه انتخاب نشده است');
    }

    const settings = await tx.receptionSettings.findUnique({
      where: { year: reservation.year },
    });
    const now = new Date();
    await tx.reservationMember.updateMany({
      where: { id: { in: payable.map((item) => item.id) }, reservationId: reservation.id },
      data: {
        insuranceStatus: ReservationMemberInsuranceStatus.PAID,
        insurancePaidAt: now,
        insurancePaidAmount: settings?.insurancePremiumAmount ?? 0,
        insuranceManualNote: null,
        insuranceVerifiedAt: null,
        insuranceVerifiedById: null,
      },
    });
  }

  private isReadyToComplete(current: ReservationRecord) {
    if (current.status !== ReservationStatus.INSURANCE) return false;
    if (!current.members.length) return false;
    if (
      current.members.some((item) => !INSURANCE_OK.includes(item.insuranceStatus))
    ) {
      return false;
    }
    const male = current.members.filter((item) => item.user.gender === UserGender.MALE).length;
    const female = current.members.filter((item) => item.user.gender === UserGender.FEMALE).length;
    if (male !== current.maleCount || female !== current.femaleCount) return false;
    if (current.type === ReservationType.CARAVAN) {
      const roles = new Set(current.caravanContacts.map((item) => item.role));
      const missing = CARAVAN_CONTACT_ROLES.filter(
        (role) => !roles.has(role as CaravanContactRole),
      );
      if (missing.length) return false;
    }
    return true;
  }

  private async finishReservation(tx: Tx, current: ReservationRecord, actor: Actor) {
    const now = new Date();
    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: ReservationStatus.COMPLETED,
        insuranceCompletedAt: current.insuranceCompletedAt ?? now,
        insuranceCompletedById: current.insuranceCompletedById ?? actor.id,
        completedAt: now,
        completedById: actor.id,
      },
      include: reservationInclude,
    });
    this.emitWorkflowEvent('complete', current.id, actor.id);
    return this.serialize(updated, actor);
  }

  private assertCanComplete(current: ReservationRecord) {
    if (
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.REJECTED ||
      current.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (current.status !== ReservationStatus.INSURANCE) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (!current.members.length) {
      throw new BadRequestException('تمام اعضا هنوز بیمه تأییدشده ندارند');
    }
    const unfinished = current.members.filter(
      (item) => !INSURANCE_OK.includes(item.insuranceStatus),
    );
    if (unfinished.length) {
      throw new BadRequestException('تمام اعضا هنوز بیمه تأییدشده ندارند');
    }
    const male = current.members.filter((item) => item.user.gender === UserGender.MALE).length;
    const female = current.members.filter((item) => item.user.gender === UserGender.FEMALE).length;
    if (male !== current.maleCount || female !== current.femaleCount) {
      throw new BadRequestException('تعداد مرد و زن ثبت‌شده با پرونده هم‌خوان نیست');
    }
    if (current.type === ReservationType.CARAVAN) {
      const roles = new Set(current.caravanContacts.map((item) => item.role));
      const missing = CARAVAN_CONTACT_ROLES.filter(
        (role) => !roles.has(role as CaravanContactRole),
      );
      if (missing.length) {
        throw new BadRequestException('همه رابطین کاروان باید تعیین شوند');
      }
    }
  }

  private emitWorkflowEvent(
    event: 'complete' | 'reject' | 'return' | 'cancel',
    reservationId: string,
    actorId: string,
  ) {
    this.logger.log(`reservation.workflow ${event} ${reservationId} ${actorId}`);
  }

  private assertOwnerOrAdmin(reservation: ReservationRecord, actor: Actor) {
    if (isAdmin(actor)) return;
    if (
      reservation.createdById === actor.id ||
      reservation.caravanManagerId === actor.id
    ) {
      return;
    }
    throw new ForbiddenException('امکان انجام این عملیات روی این پرونده وجود ندارد');
  }

  private assertCanView(reservation: ReservationRecord, actor: Actor) {
    if (isAdmin(actor)) return;
    if (
      reservation.createdById === actor.id ||
      reservation.caravanManagerId === actor.id
    ) {
      return;
    }
    if (reservation.members.some((item) => item.userId === actor.id)) return;
    throw new ForbiddenException('دسترسی به این پرونده مجاز نیست');
  }

  private canSeeMembers(reservation: ReservationRecord, actor: Actor) {
    if (isAdmin(actor)) return true;
    return (
      reservation.createdById === actor.id ||
      reservation.caravanManagerId === actor.id
    );
  }

  private assertGroupOrCaravan(reservation: ReservationRecord) {
    if (
      reservation.type !== ReservationType.GROUP &&
      reservation.type !== ReservationType.CARAVAN
    ) {
      throw new BadRequestException('این پرونده گروهی نیست');
    }
  }

  private assertCaravan(reservation: ReservationRecord) {
    if (reservation.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
  }

  private assertCompanionsStatus(reservation: ReservationRecord) {
    if (reservation.status !== ReservationStatus.COMPANIONS) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
  }

  private remainingMemberSlots(reservation: ReservationRecord) {
    const males = reservation.members.filter(
      (item) => item.user.gender === UserGender.MALE,
    ).length;
    const females = reservation.members.filter(
      (item) => item.user.gender === UserGender.FEMALE,
    ).length;
    return {
      male: Math.max(0, reservation.maleCount - males),
      female: Math.max(0, reservation.femaleCount - females),
    };
  }

  private assertRemainingForImport(
    reservation: ReservationRecord,
    genders: Array<UserGender | null | undefined>,
  ) {
    if (genders.some((item) => !item)) {
      throw new BadRequestException('جنسیت همه افراد انتخاب‌شده باید مشخص باشد');
    }
    const male = genders.filter((item) => item === UserGender.MALE).length;
    const female = genders.filter((item) => item === UserGender.FEMALE).length;
    const remaining = this.remainingMemberSlots(reservation);
    if (male > remaining.male) {
      throw new BadRequestException(
        `${male - remaining.male} مرد بیشتر از تعداد باقی‌مانده پرونده وارد شده است`,
      );
    }
    if (female > remaining.female) {
      throw new BadRequestException(
        `${female - remaining.female} زن بیشتر از تعداد باقی‌مانده پرونده وارد شده است`,
      );
    }
  }

  private findPreviousCaravanReservation(
    current: ReservationRecord,
    db: Tx | PrismaService = this.prisma,
  ) {
    return db.reservation.findFirst({
      where: {
        createdById: current.createdById,
        type: ReservationType.CARAVAN,
        id: { not: current.id },
        status: { not: ReservationStatus.CANCELLED },
      },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        members: { include: { user: { select: userSelect } } },
      },
    });
  }

  private async buildMemberImportPreview(
    current: ReservationRecord,
    buffer: Buffer,
  ) {
    const parsed = await parseReservationMemberExcel(buffer);
    const currentNationalIds = new Set(
      current.members
        .map((item) => item.user.nationalId)
        .filter((item): item is string => Boolean(item)),
    );
    const currentUserIds = new Set(current.members.map((item) => item.userId));
    const nationalIds = [
      ...new Set(parsed.map((row) => row.nationalId).filter(Boolean)),
    ];
    const existingUsers = nationalIds.length
      ? await this.prisma.user.findMany({
          where: { nationalId: { in: nationalIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            nationalId: true,
            gender: true,
            phone: true,
            birthDate: true,
          },
        })
      : [];
    const existingByNationalId = new Map(
      existingUsers
        .filter((item) => item.nationalId)
        .map((item) => [item.nationalId as string, item]),
    );

    const rows = parsed.map((row) =>
      this.toPreviewRow(
        row,
        existingByNationalId.get(row.nationalId),
        currentUserIds,
        currentNationalIds,
      ),
    );
    const importable = rows.filter(
      (row) => row.status === 'VALID' && row.userState !== 'ALREADY_MEMBER',
    );
    const remaining = this.remainingMemberSlots(current);
    return {
      total: rows.length,
      valid: rows.filter((row) => row.status === 'VALID').length,
      invalid: rows.filter((row) => row.status === 'INVALID').length,
      duplicate: rows.filter((row) => row.status === 'DUPLICATE').length,
      maleCount: importable.filter((row) => row.gender === UserGender.MALE).length,
      femaleCount: importable.filter((row) => row.gender === UserGender.FEMALE).length,
      remainingMale: remaining.male,
      remainingFemale: remaining.female,
      rows,
    };
  }

  private toPreviewRow(
    row: ParsedMemberImportRow,
    user:
      | {
          id: string;
          firstName: string;
          lastName: string;
          fullName: string;
          nationalId: string | null;
          gender: UserGender | null;
          phone: string | null;
          birthDate: Date | null;
        }
      | undefined,
    currentUserIds: Set<string>,
    currentNationalIds: Set<string>,
  ) {
    const errors = user
      ? row.errors.filter((code) => {
          if (code === 'missingFirstName' || code === 'missingLastName') return false;
          if ((code === 'missingGender' || code === 'invalidGender') && user.gender) {
            return false;
          }
          return true;
        })
      : [...row.errors];
    if (user && !user.gender && !row.gender && !errors.includes('missingGender')) {
      errors.push('missingGender');
    }
    const alreadyMember = Boolean(
      (user && currentUserIds.has(user.id)) ||
        (row.nationalId && currentNationalIds.has(row.nationalId)),
    );
    const userState = alreadyMember
      ? 'ALREADY_MEMBER'
      : user
        ? 'EXISTING'
        : 'NEW';
    const status = errors.includes('duplicateInFile')
      ? 'DUPLICATE'
      : errors.length
        ? 'INVALID'
        : 'VALID';
    return {
      rowNumber: row.rowNumber,
      nationalId: user?.nationalId ?? row.nationalId,
      firstName: user?.firstName ?? row.firstName,
      lastName: user?.lastName ?? row.lastName,
      gender: user?.gender ?? row.gender,
      genderText: row.genderText,
      phone: user?.phone ?? row.phone,
      birthDate: toDateOnly(user?.birthDate) ?? row.birthDate,
      status,
      errors,
      duplicateOfRow: row.duplicateOfRow,
      userState,
      existingUser: user
        ? { fullName: user.fullName, gender: user.gender }
        : undefined,
    };
  }

  private clearAfterReturn(
    status: ReservationStatus,
  ): Prisma.ReservationUncheckedUpdateInput {
    const base: Prisma.ReservationUncheckedUpdateInput = {
      insuranceCompletedAt: null,
      insuranceCompletedById: null,
      completedAt: null,
      completedById: null,
    };
    if (status === ReservationStatus.DRAFT) {
      return {
        ...base,
        basicInfoCompletedAt: null,
        basicInfoCompletedById: null,
        managementReviewedAt: null,
        managementReviewedById: null,
        basicInfoLockedAt: null,
        companionsCompletedAt: null,
        companionsCompletedById: null,
        caravanContactsCompletedAt: null,
        caravanContactsCompletedById: null,
      };
    }
    if (status === ReservationStatus.COMPANIONS) {
      return {
        ...base,
        companionsCompletedAt: null,
        companionsCompletedById: null,
        caravanContactsCompletedAt: null,
        caravanContactsCompletedById: null,
      };
    }
    if (status === ReservationStatus.CARAVAN_CONTACTS) {
      return {
        ...base,
        caravanContactsCompletedAt: null,
        caravanContactsCompletedById: null,
      };
    }
    return base;
  }

  private serializeListItem(row: ReservationRecord) {
    return {
      id: row.id,
      year: row.year,
      type: row.type,
      status: row.status,
      originCity: row.originCity,
      stayStartDate: toDateOnly(row.stayStartDate),
      stayEndDate: toDateOnly(row.stayEndDate),
      walkingStartDate: toDateOnly(row.walkingStartDate),
      maleCount: row.maleCount,
      femaleCount: row.femaleCount,
      totalCount: row.totalCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      caravan: row.caravan,
      createdBy: row.createdBy,
      caravanManager: row.caravanManager,
    };
  }

  private serialize(row: ReservationRecord, actor: Actor) {
    const admin = isAdmin(actor);
    const seeMembers = this.canSeeMembers(row, actor);
    return {
      id: row.id,
      createdBy: row.createdBy,
      year: row.year,
      type: row.type,
      status: row.status,
      originCity: row.originCity,
      walkingRoute: row.walkingRoute,
      stayStartDate: toDateOnly(row.stayStartDate),
      stayEndDate: toDateOnly(row.stayEndDate),
      walkingStartDate: toDateOnly(row.walkingStartDate),
      maleCount: row.maleCount,
      femaleCount: row.femaleCount,
      totalCount: row.totalCount,
      caravan: row.caravan,
      caravanManager: row.caravanManager,
      caravanManagerNotes: seeMembers ? row.caravanManagerNotes : null,
      managementNotes: admin ? row.managementNotes : null,
      rejectionReason: admin || seeMembers ? row.rejectionReason : null,
      basicInfoLockedAt: row.basicInfoLockedAt?.toISOString() ?? null,
      basicInfoCompletedAt: row.basicInfoCompletedAt?.toISOString() ?? null,
      managementReviewedAt: row.managementReviewedAt?.toISOString() ?? null,
      companionsCompletedAt: row.companionsCompletedAt?.toISOString() ?? null,
      caravanContactsCompletedAt: row.caravanContactsCompletedAt?.toISOString() ?? null,
      insuranceCompletedAt: row.insuranceCompletedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      returnedToStatus: row.returnedToStatus,
      basicInfoCompletedBy: row.basicInfoCompletedBy,
      managementReviewedBy: row.managementReviewedBy,
      companionsCompletedBy: row.companionsCompletedBy,
      caravanContactsCompletedBy: row.caravanContactsCompletedBy,
      insuranceCompletedBy: row.insuranceCompletedBy,
      completedBy: row.completedBy,
      rejectedBy: row.rejectedBy,
      cancelledBy: row.cancelledBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      members: seeMembers ? row.members.map((item) => this.serializeMember(item)) : undefined,
      caravanContacts: seeMembers
        ? row.caravanContacts.map((item) => this.serializeContact(item))
        : undefined,
    };
  }

  private serializeMember(item: ReservationRecord['members'][number]) {
    return {
      id: item.id,
      user: {
        ...item.user,
        birthDate: toDateOnly(item.user.birthDate),
      },
      insuranceStatus: item.insuranceStatus,
      insurancePaidAt: item.insurancePaidAt?.toISOString() ?? null,
      insurancePaidAmount: item.insurancePaidAmount,
      insurancePaymentRef: item.insurancePaymentRef,
      insuranceManualNote: item.insuranceManualNote,
    };
  }

  private serializeContact(item: ReservationRecord['caravanContacts'][number]) {
    return {
      id: item.id,
      role: item.role,
      user: {
        ...item.user,
        birthDate: toDateOnly(item.user.birthDate),
      },
    };
  }
}

function isReservationId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function parseSearchYear(value: string) {
  const digits = toLatinDigits(value).replace(/\D/g, '');
  if (digits.length !== 4) return undefined;
  const year = Number(digits);
  if (year < 1300 || year > 1600) return undefined;
  return year;
}

function matchSearchType(value: string) {
  const term = value.trim().toLowerCase();
  if (!term) return undefined;
  if (term === 'individual' || term.includes('انفرادی')) {
    return ReservationType.INDIVIDUAL;
  }
  if (term === 'group' || term.includes('گروهی')) {
    return ReservationType.GROUP;
  }
  if (term === 'caravan' || term.includes('کاروانی') || term === 'کاروان') {
    return ReservationType.CARAVAN;
  }
  return undefined;
}

function toDateOnly(value?: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function memberImportErrorLabel(code: string) {
  const labels: Record<string, string> = {
    missingNationalId: 'کد ملی وارد نشده است',
    invalidNationalId: 'کد ملی نامعتبر است',
    missingFirstName: 'نام وارد نشده است',
    missingLastName: 'نام خانوادگی وارد نشده است',
    missingGender: 'جنسیت مشخص نشده است',
    invalidGender: 'جنسیت نامعتبر است',
    invalidPhone: 'شماره همراه نامعتبر است',
    invalidBirthDate: 'تاریخ تولد نامعتبر است',
    duplicateInFile: 'این کد ملی در همین فایل تکرار شده است',
  };
  return labels[code] ?? code;
}
