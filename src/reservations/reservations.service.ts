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
  isHonoraryServant,
  isPilgrim,
  type RoleBearer,
} from '../auth/roles.util';
import {
  addDaysIso,
  parseIsoDate,
  parseOptionalIsoDate,
} from '../common/iso-date';
import { toLatinDigits } from '../common/national-id';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import {
  isReservationCodeQuery,
  nextSequentialReservationCode,
  normalizeReservationCode,
} from '../common/reservation-code';
import { resolveSortOrder } from '../common/sort-query';
import {
  AllocationStatus,
  CaravanContactRole,
  IssuedLicenseStatus,
  PlacementGenderPolicy,
  PlacementMode,
  PlacementStatus,
  Prisma,
  ReceptionSettings,
  ReservationMemberInsurancePaidMethod,
  ReservationMemberInsuranceStatus,
  ReservationPermitSource,
  ReservationPermitStatus,
  ReservationStatus,
  ReservationType,
  UserGender,
} from '../generated/prisma/client';
import { buildStyledExcelExport } from '../common/excel-export';
import { jalaliYearRange } from '../common/jalali-year';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PlacementsService } from '../placements/placements.service';
import { placementStatusFromCounts } from '../placements/placement-capacity';
import { AddReservationMemberDto } from './dto/add-reservation-member.dto';
import { UpdateReservationMemberDto } from './dto/update-reservation-member.dto';
import {
  parseReservationMemberExcel,
  type ParsedMemberImportRow,
} from './reservation-member-excel';
import { AdjustReservationCapacityDto } from './dto/adjust-reservation-capacity.dto';
import { ApproveReservationDto } from './dto/approve-reservation.dto';
import { AssignReservationHonoraryDto } from './dto/assign-reservation-honorary.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';
import { RejectReservationPermitDto } from './dto/reject-reservation-permit.dto';
import { ReservationPermitOptionsQueryDto } from './dto/reservation-permit-options-query.dto';
import { SetReservationContactDto } from './dto/set-reservation-contact.dto';
import { UpdateMemberInsuranceDto } from './dto/update-member-insurance.dto';
import { UpdateReceptionSettingsDto } from './dto/update-reception-settings.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { UpdateReservationPermitDto } from './dto/update-reservation-permit.dto';
import {
  assertCapacity,
  occupiedCounts,
  remainingCapacity,
} from './reservation-capacity';
import {
  CARAVAN_CONTACT_ROLES,
  IN_PROGRESS_FILTER,
  IN_PROGRESS_STATUSES,
  canAdjustApprovedCapacity,
  companionEditStatuses,
  contactEditStatuses,
  isOccupyingStatus,
  isOwnerCreateDraft,
  nextAfterBasicInfo,
  nextAfterCompanions,
  nextAfterManagement,
  placementModeFromSettings,
  settingsAutoApproveKey,
  settingsCapacityKeys,
  settingsEnabledKey,
  unapprovedCounts,
  validRewindStatuses,
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
  country: { select: { iso2: true } },
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
    select: {
      id: true,
      name: true,
      managerUserId: true,
      maleCount: true,
      femaleCount: true,
      totalCount: true,
      city: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          provinceId: true,
        },
      },
    },
  },
  group: {
    select: {
      id: true,
      name: true,
      managerUserId: true,
      maleCount: true,
      femaleCount: true,
      totalCount: true,
      city: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          provinceId: true,
        },
      },
    },
  },
  createdBy: { select: userSelect },
  caravanManager: { select: userSelect },
  honoraryAssignments: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    include: {
      user: { select: userSelect },
      serviceType: { select: { id: true, name: true, code: true } },
      assignedBy: { select: userSelect },
    },
  },
  basicInfoCompletedBy: { select: userSelect },
  managementReviewedBy: { select: userSelect },
  companionsCompletedBy: { select: userSelect },
  caravanContactsCompletedBy: { select: userSelect },
  insuranceCompletedBy: { select: userSelect },
  completedBy: { select: userSelect },
  placementCompletedBy: { select: userSelect },
  rejectedBy: { select: userSelect },
  cancelledBy: { select: userSelect },
  permitReviewedBy: { select: userSelect },
  issuedLicense: {
    select: {
      id: true,
      managerUserId: true,
      caravanId: true,
      organizationId: true,
      description: true,
      issuedAt: true,
      status: true,
      fileId: true,
      organization: { select: { id: true, name: true } },
      issuer: { select: userSelect },
    },
  },
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: { select: userSelect },
      insurancePaidBy: { select: userSelect },
    },
  },
  caravanContacts: {
    orderBy: { role: 'asc' as const },
    include: { user: { select: userSelect } },
  },
  allocations: {
    where: { status: AllocationStatus.ACTIVE },
    orderBy: { placedAt: 'asc' as const },
    include: {
      accommodation: {
        select: {
          id: true,
          name: true,
          genderType: true,
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
    },
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
  individualPlacementMode: PlacementMode.MANUAL,
  individualIntro: '',
  individualRules: '',
  groupEnabled: false,
  groupMaleCapacity: 0,
  groupFemaleCapacity: 0,
  groupAutoApprove: false,
  groupPlacementMode: PlacementMode.MANUAL,
  groupIntro: '',
  groupRules: '',
  caravanEnabled: false,
  caravanMaleCapacity: 0,
  caravanFemaleCapacity: 0,
  caravanAutoApprove: false,
  caravanAutoApproveLicenses: false,
  caravanPlacementMode: PlacementMode.MANUAL,
  caravanIntro: '',
  caravanRules: '',
  placementGenderPolicy: PlacementGenderPolicy.SINGLE_GENDER,
  insuranceOrganization: '',
  insurancePlans: [],
  imamRezaMartyrdomDate: null,
  prophetDemiseDate: null,
});

type SettingsWithPlans = ReceptionSettings & {
  insurancePlans: {
    id: string;
    coverageAmount: number;
    premiumAmount: number;
    description: string;
    sortOrder: number;
  }[];
};

function serializeSettings(row: SettingsWithPlans, exists = true) {
  return {
    year: row.year,
    exists,
    individualEnabled: row.individualEnabled,
    individualMaleCapacity: row.individualMaleCapacity,
    individualFemaleCapacity: row.individualFemaleCapacity,
    individualAutoApprove: row.individualAutoApprove,
    individualPlacementMode: row.individualPlacementMode,
    individualIntro: row.individualIntro ?? '',
    individualRules: row.individualRules ?? '',
    groupEnabled: row.groupEnabled,
    groupMaleCapacity: row.groupMaleCapacity,
    groupFemaleCapacity: row.groupFemaleCapacity,
    groupAutoApprove: row.groupAutoApprove,
    groupPlacementMode: row.groupPlacementMode,
    groupIntro: row.groupIntro ?? '',
    groupRules: row.groupRules ?? '',
    caravanEnabled: row.caravanEnabled,
    caravanMaleCapacity: row.caravanMaleCapacity,
    caravanFemaleCapacity: row.caravanFemaleCapacity,
    caravanAutoApprove: row.caravanAutoApprove,
    caravanAutoApproveLicenses: row.caravanAutoApproveLicenses,
    caravanPlacementMode: row.caravanPlacementMode,
    caravanIntro: row.caravanIntro ?? '',
    caravanRules: row.caravanRules ?? '',
    placementGenderPolicy: row.placementGenderPolicy,
    insuranceOrganization: row.insuranceOrganization ?? '',
    insurancePlans: (row.insurancePlans ?? []).map((plan) => ({
      id: plan.id,
      coverageAmount: plan.coverageAmount,
      premiumAmount: plan.premiumAmount,
      description: plan.description ?? '',
      sortOrder: plan.sortOrder,
    })),
    imamRezaMartyrdomDate: toDateOnly(row.imamRezaMartyrdomDate),
    prophetDemiseDate: toDateOnly(row.prophetDemiseDate),
  };
}

const settingsInclude = {
  insurancePlans: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.ReceptionSettingsInclude;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly placements: PlacementsService,
  ) {}

  async getSettings(year: number) {
    this.assertYear(year);
    const row = await this.prisma.receptionSettings.findUnique({
      where: { year },
      include: settingsInclude,
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
    const {
      imamRezaMartyrdomDate,
      prophetDemiseDate,
      insurancePlans,
      ...rest
    } = dto;
    this.assertOccasionDates(prophetDemiseDate, imamRezaMartyrdomDate);
    const data = {
      ...rest,
      imamRezaMartyrdomDate:
        parseOptionalIsoDate(imamRezaMartyrdomDate) ?? null,
      prophetDemiseDate: parseOptionalIsoDate(prophetDemiseDate) ?? null,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.receptionSettings.upsert({
        where: { year },
        create: { year, ...data },
        update: data,
      });
      const existing = await tx.receptionInsurancePlan.findMany({
        where: { year },
        select: { id: true },
      });
      const keepIds = new Set(
        insurancePlans
          .map((plan) => plan.id)
          .filter((id): id is string => Boolean(id)),
      );
      const removeIds = existing
        .map((item) => item.id)
        .filter((id) => !keepIds.has(id));
      if (removeIds.length) {
        await tx.receptionInsurancePlan.deleteMany({
          where: { id: { in: removeIds }, year },
        });
      }
      for (const [index, plan] of insurancePlans.entries()) {
        const payload = {
          coverageAmount: plan.coverageAmount,
          premiumAmount: plan.premiumAmount,
          description: plan.description ?? '',
          sortOrder: index,
        };
        if (
          plan.id &&
          keepIds.has(plan.id) &&
          existing.some((item) => item.id === plan.id)
        ) {
          await tx.receptionInsurancePlan.update({
            where: { id: plan.id },
            data: payload,
          });
        } else {
          await tx.receptionInsurancePlan.create({
            data: { year, ...payload },
          });
        }
      }
      return tx.receptionSettings.findUniqueOrThrow({
        where: { year },
        include: settingsInclude,
      });
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

    const pendingReview = statusCount(
      ReservationStatus.PENDING_MANAGEMENT_REVIEW,
    );
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
      individual: remainingCapacity(
        settings,
        ReservationType.INDIVIDUAL,
        individual,
      ),
      group: remainingCapacity(settings, ReservationType.GROUP, group),
      caravan: remainingCapacity(settings, ReservationType.CARAVAN, caravan),
    };
  }

  async create(dto: CreateReservationDto, actor: Actor) {
    const asDraft = Boolean(dto.asDraft);
    const maleCount = dto.maleCount ?? 0;
    const femaleCount = dto.femaleCount ?? 0;
    this.assertDraftOrFullCounts(asDraft, maleCount, femaleCount);
    this.assertGroupSize(dto.type, maleCount, femaleCount);
    this.assertDraftOrFullTripDates(
      asDraft,
      dto.walkingStartDate,
      dto.stayStartDate,
      dto.stayEndDate,
    );
    const settings = await this.requireEnabledSettings(dto.year, dto.type);
    if (!asDraft && !dto.walkingRouteId) {
      throw new BadRequestException('مسیر پیاده‌روی را انتخاب کنید');
    }
    if (dto.originCityId) await this.assertOriginCity(dto.originCityId);
    await this.assertWalkingRoute(dto.walkingRouteId);

    const createdById = await this.resolveCreatedById(dto.createdById, actor);
    await this.assertInternationalCaravanOnly(createdById, dto.type);
    const caravan = await this.resolveCaravan(dto, actor);
    const group = await this.resolveGroup(dto, actor);
    if (!asDraft) {
      if (dto.type === ReservationType.CARAVAN && !caravan) {
        throw new BadRequestException('کاروان را انتخاب کنید');
      }
      if (dto.type === ReservationType.GROUP && !group) {
        throw new BadRequestException('گروه را انتخاب کنید');
      }
    }
    const permit =
      dto.type === ReservationType.CARAVAN && caravan
        ? await this.resolvePermitInput(
            {
              year: dto.year,
              caravanId: caravan.id,
              managerUserId: caravan.managerUserId,
              issuedLicenseId: dto.issuedLicenseId,
              permitImageId: dto.permitImageId,
            },
            { required: !asDraft },
          )
        : emptyPermitData();

    const result = await this.withCodeConflictRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const { code, codeSeq } = await this.nextReservationCode(tx, dto.year);
        const created = await tx.reservation.create({
          data: {
            createdById,
            year: dto.year,
            code,
            codeSeq,
            type: dto.type,
            status: ReservationStatus.DRAFT,
            placementMode: placementModeFromSettings(settings, dto.type),
            originCityId: dto.originCityId ?? null,
            walkingRouteId: dto.walkingRouteId ?? null,
            stayStartDate: parseOptionalIsoDate(dto.stayStartDate) ?? null,
            stayEndDate: parseOptionalIsoDate(dto.stayEndDate) ?? null,
            walkingStartDate: parseOptionalIsoDate(dto.walkingStartDate) ?? null,
            requestsAccommodation: dto.requestsAccommodation ?? true,
            requestsBus: dto.requestsBus ?? true,
            requestsSimCard: dto.requestsSimCard ?? false,
            requestsBankCard: dto.requestsBankCard ?? false,
            specialServices: dto.specialServices?.trim() || null,
            requestedMaleCount: maleCount,
            requestedFemaleCount: femaleCount,
            maleCount,
            femaleCount,
            totalCount: maleCount + femaleCount,
            caravanId: caravan?.id ?? null,
            groupId: group?.id ?? null,
            caravanManagerId: caravan?.managerUserId ?? null,
            createWizardStep: dto.createWizardStep?.trim() || null,
            ...permit,
          },
          include: reservationInclude,
        });
        if (maleCount + femaleCount > 0) {
          await this.syncPartyCapacity(tx, {
            type: dto.type,
            groupId: group?.id ?? null,
            caravanId: caravan?.id ?? null,
            maleCount,
            femaleCount,
            year: dto.year,
          });
        }
        if (asDraft) {
          return this.serialize(created, actor);
        }
        return this.submitDraft(tx, created, actor);
      }),
    );
    await this.users.ensureRole(createdById, 'PILGRIM');
    return result;
  }

  async update(id: string, dto: UpdateReservationDto, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (isAdmin(actor)) {
      this.assertNotCancelled(current);
    } else {
      if (current.status !== ReservationStatus.DRAFT) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }
      if (current.basicInfoLockedAt) {
        throw new BadRequestException('پرونده قفل است');
      }
      this.assertNoLockedFieldChange(dto, Boolean(current.basicInfoLockedAt));
    }

    const type = dto.type ?? current.type;
    await this.assertInternationalCaravanOnly(current.createdById, type);
    const year = dto.year ?? current.year;
    const draftSoft = current.status === ReservationStatus.DRAFT;
    const pendingReview =
      current.status === ReservationStatus.PENDING_MANAGEMENT_REVIEW;
    const dualCounts =
      dto.requestedMaleCount !== undefined ||
      dto.requestedFemaleCount !== undefined;
    const explicitApproved =
      dto.maleCount !== undefined || dto.femaleCount !== undefined;

    let requestedMaleCount: number;
    let requestedFemaleCount: number;
    let maleCount: number;
    let femaleCount: number;

    if (dualCounts) {
      requestedMaleCount = dto.requestedMaleCount ?? current.requestedMaleCount;
      requestedFemaleCount =
        dto.requestedFemaleCount ?? current.requestedFemaleCount;
      if (pendingReview) {
        maleCount = dto.maleCount ?? current.maleCount;
        femaleCount = dto.femaleCount ?? current.femaleCount;
      } else if (draftSoft) {
        maleCount = dto.maleCount ?? requestedMaleCount;
        femaleCount = dto.femaleCount ?? requestedFemaleCount;
      } else {
        maleCount = dto.maleCount ?? current.maleCount;
        femaleCount = dto.femaleCount ?? current.femaleCount;
      }
    } else if (pendingReview || draftSoft) {
      requestedMaleCount = dto.maleCount ?? current.requestedMaleCount;
      requestedFemaleCount = dto.femaleCount ?? current.requestedFemaleCount;
      maleCount = draftSoft ? requestedMaleCount : 0;
      femaleCount = draftSoft ? requestedFemaleCount : 0;
    } else {
      requestedMaleCount = current.requestedMaleCount;
      requestedFemaleCount = current.requestedFemaleCount;
      maleCount = dto.maleCount ?? current.maleCount;
      femaleCount = dto.femaleCount ?? current.femaleCount;
    }

    const validateMale =
      pendingReview || draftSoft ? requestedMaleCount : maleCount;
    const validateFemale =
      pendingReview || draftSoft ? requestedFemaleCount : femaleCount;
    this.assertDraftOrFullCounts(draftSoft, validateMale, validateFemale);
    this.assertGroupSize(type, validateMale, validateFemale);
    this.assertCountsCoverMembers(current, validateMale, validateFemale);

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
    this.assertDraftOrFullTripDates(
      draftSoft,
      walkingStart,
      stayStart,
      stayEnd,
    );

    let placementMode: PlacementMode | undefined;
    if (dto.type || dto.year) {
      const settings = await this.requireEnabledSettings(year, type);
      if (type !== current.type || year !== current.year) {
        placementMode = placementModeFromSettings(settings, type);
      }
    }
    if (dto.originCityId) await this.assertOriginCity(dto.originCityId);
    if (dto.walkingRouteId !== undefined) {
      await this.assertWalkingRoute(dto.walkingRouteId);
    }

    const caravan = await this.resolveCaravan(
      {
        type,
        caravanId: this.resolveDraftPartyId(
          draftSoft,
          dto.caravanId,
          current.caravanId,
        ),
        caravanManagerId:
          dto.caravanManagerId === undefined
            ? current.caravanManagerId
            : dto.caravanManagerId,
      },
      actor,
    );
    const group = await this.resolveGroup(
      {
        type,
        groupId: this.resolveDraftPartyId(
          draftSoft,
          dto.groupId,
          current.groupId,
        ),
      },
      actor,
    );
    if (!draftSoft) {
      if (type === ReservationType.CARAVAN && !caravan) {
        throw new BadRequestException('کاروان را انتخاب کنید');
      }
      if (type === ReservationType.GROUP && !group) {
        throw new BadRequestException('گروه را انتخاب کنید');
      }
    }

    let permitPatch: Prisma.ReservationUncheckedUpdateInput = {};
    if (
      type === ReservationType.CARAVAN &&
      caravan &&
      (dto.issuedLicenseId !== undefined || dto.permitImageId !== undefined)
    ) {
      permitPatch = await this.resolvePermitInput(
        {
          year,
          caravanId: caravan.id,
          managerUserId: caravan.managerUserId,
          issuedLicenseId:
            dto.issuedLicenseId !== undefined
              ? dto.issuedLicenseId
              : current.issuedLicenseId,
          permitImageId:
            dto.permitImageId !== undefined
              ? dto.permitImageId
              : current.permitImageId,
        },
        { required: false },
      );
    }

    const data: Prisma.ReservationUncheckedUpdateInput = {
      type,
      year,
      originCityId:
        dto.originCityId === undefined ? undefined : dto.originCityId,
      walkingRouteId:
        dto.walkingRouteId === undefined ? undefined : dto.walkingRouteId,
      stayStartDate: parseOptionalIsoDate(dto.stayStartDate),
      stayEndDate: parseOptionalIsoDate(dto.stayEndDate),
      walkingStartDate: parseOptionalIsoDate(dto.walkingStartDate),
      requestsAccommodation: dto.requestsAccommodation,
      requestsBus: dto.requestsBus,
      requestsSimCard: dto.requestsSimCard,
      requestsBankCard: dto.requestsBankCard,
      specialServices:
        dto.specialServices === undefined
          ? undefined
          : dto.specialServices?.trim() || null,
      requestedMaleCount,
      requestedFemaleCount,
      ...(pendingReview && !(dualCounts && explicitApproved)
        ? unapprovedCounts()
        : {
            maleCount,
            femaleCount,
            totalCount: maleCount + femaleCount,
          }),
      caravanId:
        type === ReservationType.CARAVAN ? (caravan?.id ?? null) : null,
      groupId: type === ReservationType.GROUP ? (group?.id ?? null) : null,
      caravanManagerId:
        type === ReservationType.CARAVAN
          ? (caravan?.managerUserId ?? null)
          : null,
      caravanManagerNotes:
        dto.caravanManagerNotes === undefined
          ? undefined
          : dto.caravanManagerNotes?.trim() || null,
      createWizardStep:
        dto.createWizardStep === undefined
          ? undefined
          : dto.createWizardStep?.trim() || null,
      ...(placementMode ? { placementMode } : {}),
      ...permitPatch,
      ...(isAdmin(actor) ? issuedServicesPatch(dto) : {}),
    };

    const countsChanged =
      maleCount !== current.maleCount || femaleCount !== current.femaleCount;
    const needsCapacity =
      isAdmin(actor) &&
      isOccupyingStatus(current.status) &&
      (countsChanged || type !== current.type);
    const partySyncMale =
      pendingReview || draftSoft ? requestedMaleCount : maleCount;
    const partySyncFemale =
      pendingReview || draftSoft ? requestedFemaleCount : femaleCount;

    const yearChanged = year !== current.year;
    const runUpdate = () =>
      this.prisma.$transaction(async (tx) => {
        if (yearChanged) {
          const allocated = await this.nextReservationCode(tx, year);
          data.code = allocated.code;
          data.codeSeq = allocated.codeSeq;
        }
        if (needsCapacity) {
          const settings = await this.requireSettings(year, tx);
          await assertCapacity(
            tx,
            settings,
            type,
            year,
            maleCount,
            femaleCount,
            current.id,
          );
        }
        const row = await tx.reservation.update({
          where: { id },
          data,
          include: reservationInclude,
        });
        if (partySyncMale + partySyncFemale > 0) {
          await this.syncPartyCapacity(tx, {
            type,
            groupId: type === ReservationType.GROUP ? (group?.id ?? null) : null,
            caravanId:
              type === ReservationType.CARAVAN ? (caravan?.id ?? null) : null,
            maleCount: partySyncMale,
            femaleCount: partySyncFemale,
            year,
            updateYear: isOccupyingStatus(current.status),
          });
        }
        return row;
      });
    const updated = yearChanged
      ? await this.withCodeConflictRetry(runUpdate)
      : await runUpdate();
    return this.serialize(updated, actor);
  }

  async submit(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      return this.submitDraft(tx, current, actor);
    });
  }

  async approve(id: string, actor: Actor, dto?: ApproveReservationDto) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      if (current.status !== ReservationStatus.PENDING_MANAGEMENT_REVIEW) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }

      const counts = this.resolveApprovedCounts(current, dto);
      const settings = await this.requireSettings(current.year, tx);
      await assertCapacity(
        tx,
        settings,
        current.type,
        current.year,
        counts.maleCount,
        counts.femaleCount,
        current.id,
      );

      const international = await this.isInternationalApplicant(tx, current);
      if (current.type === ReservationType.INDIVIDUAL && !international) {
        await this.ensureApplicantMember(tx, current);
      }

      const now = new Date();
      const trimmedNotes = dto?.notes?.trim();
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          maleCount: counts.maleCount,
          femaleCount: counts.femaleCount,
          totalCount: counts.maleCount + counts.femaleCount,
          managementNotes: trimmedNotes
            ? trimmedNotes
            : current.managementNotes,
          ...(international
            ? {
                ...this.internationalCompletionPatch(now, actor.id),
                placementStatus: PlacementStatus.NOT_REQUIRED,
                placementCompletedAt: null,
                placementCompletedById: null,
                ...(current.type === ReservationType.CARAVAN
                  ? {
                      hasPermit: true,
                      permitStatus: ReservationPermitStatus.APPROVED,
                      permitReviewedAt: now,
                      permitReviewedById: actor.id,
                      permitRejectionReason: null,
                    }
                  : {}),
              }
            : {
                status: nextAfterManagement(current.type),
                managementReviewedAt: now,
                managementReviewedById: actor.id,
                basicInfoLockedAt: now,
              }),
        },
        include: reservationInclude,
      });
      await this.syncPartyCapacity(tx, {
        type: current.type,
        groupId: current.groupId,
        caravanId: current.caravanId,
        maleCount: counts.maleCount,
        femaleCount: counts.femaleCount,
        year: current.year,
        updateYear: true,
      });
      if (international) {
        this.emitWorkflowEvent('complete', current.id, actor.id);
      }
      return this.serialize(updated, actor);
    });
  }

  async adjustCapacity(
    id: string,
    dto: AdjustReservationCapacityDto,
    actor: Actor,
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      if (
        !current.managementReviewedAt ||
        !canAdjustApprovedCapacity(current.type, current.status)
      ) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }

      const counts = this.resolveApprovedCounts(current, dto);
      this.assertCountsCoverMembers(
        current,
        counts.maleCount,
        counts.femaleCount,
      );

      const allocated = current.allocations.reduce(
        (sum, item) => {
          if (item.gender === UserGender.MALE) sum.male += item.headcount;
          if (item.gender === UserGender.FEMALE) sum.female += item.headcount;
          return sum;
        },
        { male: 0, female: 0 },
      );
      if (
        allocated.male > counts.maleCount ||
        allocated.female > counts.femaleCount
      ) {
        throw new BadRequestException(
          'ظرفیت نمی‌تواند کمتر از تعداد اسکان‌داده‌شده باشد',
        );
      }

      const settings = await this.requireSettings(current.year, tx);
      await assertCapacity(
        tx,
        settings,
        current.type,
        current.year,
        counts.maleCount,
        counts.femaleCount,
        current.id,
      );

      const nextPlacement =
        current.placementStatus === PlacementStatus.NOT_REQUIRED
          ? null
          : placementStatusFromCounts({
              requestsAccommodation: current.requestsAccommodation,
              maleCount: counts.maleCount,
              femaleCount: counts.femaleCount,
              allocatedMale: allocated.male,
              allocatedFemale: allocated.female,
            });

      const updated = await tx.reservation.update({
        where: { id },
        data: {
          maleCount: counts.maleCount,
          femaleCount: counts.femaleCount,
          totalCount: counts.maleCount + counts.femaleCount,
          ...(nextPlacement
            ? {
                placementStatus: nextPlacement,
                ...(nextPlacement === PlacementStatus.PLACED
                  ? {}
                  : {
                      placementCompletedAt: null,
                      placementCompletedById: null,
                    }),
              }
            : {}),
        },
        include: reservationInclude,
      });
      await this.syncPartyCapacity(tx, {
        type: current.type,
        groupId: current.groupId,
        caravanId: current.caravanId,
        maleCount: counts.maleCount,
        femaleCount: counts.femaleCount,
        year: current.year,
        updateYear: true,
      });
      return this.serialize(updated, actor);
    });
  }

  async reject(id: string, reason: string | null | undefined, actor: Actor) {
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
        rejectionReason: reason?.trim() || null,
        rejectedAt: new Date(),
        rejectedById: actor.id,
      },
      include: reservationInclude,
    });
    this.emitWorkflowEvent('reject', id, actor.id);
    return this.serialize(updated, actor);
  }

  /** Rewind from rejected, in-progress, or completed. Owner flow uses next/prev instead. */
  async returnTo(id: string, status: ReservationStatus, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException(
        'فقط مدیریت می‌تواند پرونده را به مرحله قبل برگرداند',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      const allowed = validRewindStatuses(current.type, current.status);
      if (!allowed.length) {
        throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
      }
      if (!allowed.includes(status)) {
        throw new BadRequestException(
          'مرحله مقصد برای این نوع پذیرش معتبر نیست',
        );
      }

      const occupyUnapproved =
        isOccupyingStatus(status) &&
        !current.managementReviewedAt &&
        current.maleCount + current.femaleCount === 0;
      const countsForStatus =
        status === ReservationStatus.DRAFT || occupyUnapproved
          ? {
              maleCount: current.requestedMaleCount,
              femaleCount: current.requestedFemaleCount,
              totalCount:
                current.requestedMaleCount + current.requestedFemaleCount,
            }
          : status === ReservationStatus.PENDING_MANAGEMENT_REVIEW
            ? unapprovedCounts()
            : null;

      if (isOccupyingStatus(status)) {
        const settings = await this.requireSettings(current.year, tx);
        await assertCapacity(
          tx,
          settings,
          current.type,
          current.year,
          countsForStatus?.maleCount ?? current.maleCount,
          countsForStatus?.femaleCount ?? current.femaleCount,
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
          ...countsForStatus,
        } satisfies Prisma.ReservationUncheckedUpdateInput,
        include: reservationInclude,
      });
      if (countsForStatus) {
        await this.syncPartyCapacity(tx, {
          type: current.type,
          groupId: current.groupId,
          caravanId: current.caravanId,
          maleCount: countsForStatus.maleCount,
          femaleCount: countsForStatus.femaleCount,
          year: current.year,
          updateYear: isOccupyingStatus(status),
        });
      }
      this.emitWorkflowEvent('return', id, actor.id);
      await this.placements.vacateActiveForReservation(tx, id, actor.id);
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
    await this.placements.vacateActiveForReservation(
      this.prisma,
      id,
      actor.id,
    );
    this.emitWorkflowEvent('cancel', id, actor.id);
    return this.serialize(updated, actor);
  }

  /** Hard-delete an owner create-wizard draft (پیش‌نویس / اطلاعات اولیه). */
  async remove(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (!isOwnerCreateDraft(current)) {
      throw new BadRequestException(
        'فقط پرونده پیش‌نویس یا اطلاعات اولیه قابل حذف است',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const permitImageId = current.permitImageId;
      const partyMale = current.requestedMaleCount || current.maleCount;
      const partyFemale = current.requestedFemaleCount || current.femaleCount;

      await tx.reservation.delete({ where: { id } });

      if (permitImageId) {
        await tx.storedImage.deleteMany({ where: { id: permitImageId } });
      }
      if (partyMale + partyFemale > 0) {
        await this.syncPartyCapacity(tx, {
          type: current.type,
          groupId: current.groupId,
          caravanId: current.caravanId,
          maleCount: 0,
          femaleCount: 0,
          year: current.year,
        });
      }

      this.logger.log(`reservation.remove ${id} by=${actor.id}`);
      return { ok: true };
    });
  }

  async findAll(query: FindReservationsQueryDto, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.list(query);
  }

  /** TEMP: hard-delete every reservation (and cascaded members/contacts). */
  async purgeAll(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }

    return this.prisma.$transaction(async (tx) => {
      const withPermitImage = await tx.reservation.findMany({
        where: { permitImageId: { not: null } },
        select: { permitImageId: true },
      });
      const permitImageIds = withPermitImage
        .map((row) => row.permitImageId)
        .filter((id): id is string => Boolean(id));

      const deleted = await tx.reservation.deleteMany({});

      if (permitImageIds.length) {
        await tx.storedImage.deleteMany({
          where: { id: { in: permitImageIds } },
        });
      }

      this.logger.warn(
        `reservation.purgeAll deleted=${deleted.count} by=${actor.id}`,
      );
      return { deleted: deleted.count };
    });
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

  async findAssignedToHonorary(query: FindReservationsQueryDto, actor: Actor) {
    if (!isHonoraryServant(actor) && !isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    return this.list(query, {
      honoraryAssignments: { some: { userId: actor.id } },
    });
  }

  async assignHonorary(
    id: string,
    dto: AssignReservationHonoraryDto,
    actor: Actor,
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    this.assertCanAssignHonorary(current);
    await this.assertHonoraryCandidate(dto.userId, dto.serviceTypeId);
    try {
      await this.prisma.reservationHonoraryAssignment.create({
        data: {
          reservationId: id,
          userId: dto.userId,
          serviceTypeId: dto.serviceTypeId,
          assignedById: actor.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'این خادم برای این نوع خدمت قبلاً به پرونده تخصیص داده شده است',
        );
      }
      throw error;
    }
    const updated = await this.requireReservation(id);
    this.logger.log(
      `reservation.assignHonorary ${id} user=${dto.userId} service=${dto.serviceTypeId} by=${actor.id}`,
    );
    return this.serialize(updated, actor);
  }

  async removeHonoraryAssignment(
    id: string,
    assignmentId: string,
    actor: Actor,
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    this.assertCanAssignHonorary(current);
    const assignment = current.honoraryAssignments.find(
      (item) => item.id === assignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('تخصیص خادم یافت نشد');
    }
    await this.prisma.reservationHonoraryAssignment.delete({
      where: { id: assignmentId },
    });
    const updated = await this.requireReservation(id);
    this.logger.log(
      `reservation.removeHonorary ${id} assignment=${assignmentId} by=${actor.id}`,
    );
    return this.serialize(updated, actor);
  }

  private assertCanAssignHonorary(current: ReservationRecord) {
    if (!current.managementReviewedAt) {
      throw new BadRequestException('پرونده هنوز تایید نشده است');
    }
    if (
      current.status === ReservationStatus.DRAFT ||
      current.status === ReservationStatus.REJECTED ||
      current.status === ReservationStatus.CANCELLED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
  }

  private async assertHonoraryCandidate(userId: string, serviceTypeId: string) {
    const serviceType = await this.prisma.honoraryServiceType.findUnique({
      where: { id: serviceTypeId },
      select: { id: true },
    });
    if (!serviceType) {
      throw new BadRequestException('نوع خدمت یافت نشد');
    }
    const announcement = await this.prisma.honoraryServiceAnnouncement.findFirst({
      where: { userId, serviceTypeId },
      select: { id: true },
    });
    if (!announcement) {
      throw new BadRequestException(
        'این کاربر برای این نوع خدمت اعلام همکاری ندارد',
      );
    }
  }

  async getMineHome(actor: Actor) {
    const showPilgrim = isPilgrim(actor);
    const showManager = isCaravanManager(actor);
    const [pilgrim, caravanManager] = await Promise.all([
      showPilgrim ? this.buildPilgrimHome(actor.id) : Promise.resolve(null),
      showManager
        ? this.buildCaravanManagerHome(actor.id)
        : Promise.resolve(null),
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
    const [
      totals,
      recentReservations,
      caravanCount,
      activeCaravanCount,
      recentCaravans,
    ] = await Promise.all([
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

  async findTravelHistory(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertCanView(current, actor);
    const items = await this.prisma.reservationTravelHistory.findMany({
      where: { reservationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        province: {
          select: { id: true, nameFa: true, nameEn: true, countryId: true },
        },
        city: {
          select: {
            id: true,
            nameFa: true,
            nameEn: true,
            provinceId: true,
            latitude: true,
            longitude: true,
          },
        },
        walkingRouteStage: {
          select: {
            id: true,
            name: true,
            stageNumber: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        reservationId: item.reservationId,
        userId: item.userId,
        walkingRouteStageId: item.walkingRouteStageId,
        walkingRouteStage: item.walkingRouteStage
          ? {
              ...item.walkingRouteStage,
              latitude:
                item.walkingRouteStage.latitude == null
                  ? null
                  : Number(item.walkingRouteStage.latitude),
              longitude:
                item.walkingRouteStage.longitude == null
                  ? null
                  : Number(item.walkingRouteStage.longitude),
            }
          : null,
        provinceId: item.provinceId,
        cityId: item.cityId,
        province: item.province,
        city: item.city
          ? {
              ...item.city,
              latitude:
                item.city.latitude == null ? null : Number(item.city.latitude),
              longitude:
                item.city.longitude == null ? null : Number(item.city.longitude),
            }
          : null,
        latitude: item.latitude == null ? null : Number(item.latitude),
        longitude: item.longitude == null ? null : Number(item.longitude),
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
      })),
    };
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
      this.assertWorkflowStatus(
        current,
        actor,
        companionEditStatuses(current.type),
      );

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

  async updateMember(
    id: string,
    memberId: string,
    dto: UpdateReservationMemberDto,
    actor: Actor,
  ) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertWorkflowStatus(
      current,
      actor,
      companionEditStatuses(current.type),
    );
    const member = current.members.find((item) => item.id === memberId);
    if (!member) {
      throw new NotFoundException('عضو پرونده یافت نشد');
    }
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('نام و نام خانوادگی همراه لازم است');
    }
    await this.users.updatePilgrimIdentity(member.userId, {
      nationalId: dto.nationalId,
      passportNumber: dto.passportNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      phone: dto.phone,
      birthDate: dto.birthDate,
    });
    return this.serialize(await this.requireReservation(id), actor);
  }

  async removeMember(id: string, memberId: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertWorkflowStatus(
      current,
      actor,
      companionEditStatuses(current.type),
    );
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
    this.assertCompanionsStatus(current, actor);
    const previous = await this.findPreviousCaravanReservations(current);
    const currentIds = new Set(current.members.map((item) => item.userId));
    return {
      items: previous.map((item) => {
        const maleCount = item.members.filter(
          (member) => member.user.gender === UserGender.MALE,
        ).length;
        const femaleCount = item.members.filter(
          (member) => member.user.gender === UserGender.FEMALE,
        ).length;
        const alreadyMemberCount = item.members.filter((member) =>
          currentIds.has(member.userId),
        ).length;
        return {
          id: item.id,
          code: item.code,
          year: item.year,
          status: item.status,
          stayStartDate: toDateOnly(item.stayStartDate),
          stayEndDate: toDateOnly(item.stayEndDate),
          originCity: item.originCity,
          memberCount: item.members.length,
          maleCount,
          femaleCount,
          alreadyMemberCount,
          transferableCount: item.members.length - alreadyMemberCount,
        };
      }),
    };
  }

  /** Last management-approved headcount for the same applicant (admin travel dual counts). */
  async getPreviousApprovedCounts(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type === ReservationType.INDIVIDUAL) {
      return { previous: null };
    }
    const personId = current.caravanManagerId ?? current.createdById;
    if (!personId) {
      return { previous: null };
    }
    const previous = await this.prisma.reservation.findFirst({
      where: {
        id: { not: current.id },
        type: current.type,
        status: { not: ReservationStatus.CANCELLED },
        managementReviewedAt: { not: null },
        AND: [
          {
            OR: [{ caravanManagerId: personId }, { createdById: personId }],
          },
          {
            OR: [{ maleCount: { gt: 0 } }, { femaleCount: { gt: 0 } }],
          },
        ],
      },
      orderBy: [
        { year: 'desc' },
        { managementReviewedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        year: true,
        type: true,
        status: true,
        maleCount: true,
        femaleCount: true,
        totalCount: true,
        requestedMaleCount: true,
        requestedFemaleCount: true,
        managementReviewedAt: true,
      },
    });
    if (!previous) {
      return { previous: null };
    }
    return {
      previous: {
        id: previous.id,
        year: previous.year,
        type: previous.type,
        status: previous.status,
        maleCount: previous.maleCount,
        femaleCount: previous.femaleCount,
        totalCount: previous.totalCount,
        requestedMaleCount: previous.requestedMaleCount,
        requestedFemaleCount: previous.requestedFemaleCount,
        managementReviewedAt:
          previous.managementReviewedAt?.toISOString() ?? null,
      },
    };
  }

  async copyPreviousMembers(
    id: string,
    actor: Actor,
    sourceReservationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      this.assertCaravan(current);
      this.assertCompanionsStatus(current, actor);

      if (sourceReservationId === id) {
        throw new BadRequestException(
          'نمی‌توان اعضای همین پرونده را منتقل کرد',
        );
      }

      const previous = await this.findPreviousCaravanReservationSource(
        current,
        sourceReservationId,
        tx,
      );
      if (!previous?.members.length) {
        throw new BadRequestException('پرونده کاروانی قبلی با عضو یافت نشد');
      }

      const existing = new Set(current.members.map((item) => item.userId));
      const toCreate = previous.members.filter(
        (item) => !existing.has(item.userId),
      );
      if (!toCreate.length) {
        throw new BadRequestException(
          'همه افراد این پرونده قبلاً اضافه شده‌اند',
        );
      }

      await tx.reservationMember.createMany({
        data: toCreate.map((item) => ({
          reservationId: id,
          userId: item.userId,
        })),
        skipDuplicates: true,
      });

      return this.serialize(await this.requireReservation(id, tx), actor);
    });
  }

  async memberImportTemplate(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    this.assertGroupOrCaravan(current);
    this.assertCompanionsStatus(current, actor);
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
    this.assertCompanionsStatus(current, actor);
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
        errors: row.errors
          .map((code) => memberImportErrorLabel(code))
          .join('، '),
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
    this.assertCompanionsStatus(current, actor);

    const preview = await this.buildMemberImportPreview(current, buffer);
    const byNationalId = new Map(
      preview.rows.map((row) => [row.nationalId, row]),
    );
    const selected = selectedIds.map((nationalId) => {
      const row = byNationalId.get(nationalId);
      if (!row) {
        throw new BadRequestException(`کد ملی ${nationalId} در فایل نیست`);
      }
      if (row.status !== 'VALID' || row.userState === 'ALREADY_MEMBER') {
        throw new BadRequestException(
          `ردیف ${row.rowNumber} برای ثبت آماده نیست`,
        );
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
      this.assertCompanionsStatus(fresh, actor);
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
    this.assertNotCancelled(current);
    if (current.status === ReservationStatus.REJECTED) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    this.assertCompanionsReady(current);
    if (
      current.status !== ReservationStatus.COMPANIONS &&
      !companionEditStatuses(current.type).includes(current.status)
    ) {
      if (isAdmin(actor) && current.status === ReservationStatus.COMPLETED) {
        return this.serialize(current, actor);
      }
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }

    const advancing = current.status === ReservationStatus.COMPANIONS;
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...(advancing ? { status: nextAfterCompanions(current.type) } : {}),
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
      this.assertWorkflowStatus(
        current,
        actor,
        contactEditStatuses(current.type),
      );

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

  async removeContact(id: string, role: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    this.assertWorkflowStatus(
      current,
      actor,
      contactEditStatuses(current.type),
    );
    if (!CARAVAN_CONTACT_ROLES.includes(role as CaravanContactRole)) {
      throw new BadRequestException('نقش نامعتبر است');
    }
    const existing = current.caravanContacts.find((item) => item.role === role);
    if (!existing) {
      throw new NotFoundException('مسئول این نقش یافت نشد');
    }
    await this.prisma.reservationCaravanContact.delete({
      where: {
        reservationId_role: {
          reservationId: id,
          role: role as CaravanContactRole,
        },
      },
    });
    return this.serialize(await this.requireReservation(id), actor);
  }

  async copyContactsFromCaravan(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    this.assertWorkflowStatus(
      current,
      actor,
      contactEditStatuses(current.type),
    );
    if (!current.caravanId) {
      throw new BadRequestException('کاروان این پرونده مشخص نیست');
    }

    const caravan = await this.prisma.caravan.findUnique({
      where: { id: current.caravanId },
      include: { contacts: true },
    });
    if (!caravan?.contacts.length) {
      throw new BadRequestException('برای این کاروان مسئولی تعریف نشده است');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const contact of caravan.contacts) {
        await tx.reservationCaravanContact.upsert({
          where: {
            reservationId_role: { reservationId: id, role: contact.role },
          },
          create: {
            reservationId: id,
            role: contact.role,
            userId: contact.userId,
          },
          update: { userId: contact.userId },
        });
      }
    });

    return this.serialize(await this.requireReservation(id), actor);
  }

  async removeAllContacts(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    this.assertWorkflowStatus(
      current,
      actor,
      contactEditStatuses(current.type),
    );
    await this.prisma.reservationCaravanContact.deleteMany({
      where: { reservationId: id },
    });
    return this.serialize(await this.requireReservation(id), actor);
  }

  async completeContacts(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    this.assertNotCancelled(current);
    if (current.status === ReservationStatus.REJECTED) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    this.assertContactsReady(current);
    const canRevalidate = contactEditStatuses(current.type).includes(
      current.status,
    );
    if (
      current.status !== ReservationStatus.CARAVAN_CONTACTS &&
      !canRevalidate
    ) {
      if (isAdmin(actor) && current.status === ReservationStatus.COMPLETED) {
        return this.serialize(current, actor);
      }
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }

    const advancing = current.status === ReservationStatus.CARAVAN_CONTACTS;
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...(advancing ? { status: ReservationStatus.INSURANCE } : {}),
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
    this.assertWorkflowStatus(current, actor, ReservationStatus.INSURANCE);
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
    let plan: {
      id: string;
      coverageAmount: number;
      premiumAmount: number;
    } | null = null;
    if (accepted && !member.insurancePaidAmount) {
      plan = await this.requireInsurancePlan(current.year, dto.insurancePlanId);
    }
    await this.prisma.reservationMember.update({
      where: { id: memberId },
      data: {
        insuranceStatus: accepted
          ? ReservationMemberInsuranceStatus.APPROVED
          : dto.status,
        insuranceManualNote: dto.note?.trim() || null,
        insurancePaidAt: accepted ? (member.insurancePaidAt ?? now) : null,
        insurancePaidAmount: accepted
          ? (member.insurancePaidAmount ?? plan?.premiumAmount ?? 0)
          : null,
        insuranceCoverageAmount: accepted
          ? (member.insuranceCoverageAmount ?? plan?.coverageAmount ?? null)
          : null,
        insurancePlanId: accepted
          ? (member.insurancePlanId ?? plan?.id ?? null)
          : null,
        insurancePaidMethod: accepted
          ? (member.insurancePaidMethod ??
            ReservationMemberInsurancePaidMethod.MANAGEMENT)
          : null,
        insurancePaidById: accepted
          ? (member.insurancePaidById ?? actor.id)
          : null,
        insuranceVerifiedAt: accepted ? now : null,
        insuranceVerifiedById: accepted ? actor.id : null,
      },
    });
    return this.serialize(await this.requireReservation(id), actor);
  }

  async getInsurance(id: string, actor: Actor) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    return this.summarizeInsurance(current.members);
  }

  async payInsurance(
    id: string,
    memberIds: string[],
    insurancePlanId: string,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      this.assertWorkflowStatus(current, actor, ReservationStatus.INSURANCE);
      await this.markMembersPaid(
        tx,
        current,
        memberIds,
        insurancePlanId,
        actor,
      );
      return this.serialize(await this.requireReservation(id, tx), actor);
    });
  }

  async complete(id: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireReservation(id, tx);
      this.assertOwnerOrAdmin(current, actor);
      if (current.status === ReservationStatus.COMPLETED) {
        return this.serialize(current, actor);
      }
      this.assertCanComplete(current);
      return this.finishReservation(tx, current, actor);
    });
  }

  async completeInsurance(id: string, actor: Actor) {
    return this.complete(id, actor);
  }

  async listPermitOptions(
    query: ReservationPermitOptionsQueryDto,
    actor: Actor,
  ) {
    this.assertYear(query.year);
    const caravan = await this.prisma.caravan.findUnique({
      where: { id: query.caravanId },
      select: { id: true, managerUserId: true, name: true },
    });
    if (!caravan) {
      throw new NotFoundException('کاروان یافت نشد');
    }
    if (
      !isAdmin(actor) &&
      caravan.managerUserId &&
      caravan.managerUserId !== actor.id
    ) {
      throw new ForbiddenException(
        'امکان مشاهده مجوزهای این کاروان وجود ندارد',
      );
    }
    if (!caravan.managerUserId) {
      return { items: [], managerUserId: null, caravanId: caravan.id };
    }

    const yearRange = jalaliYearRange(query.year);
    const items = await this.prisma.issuedLicense.findMany({
      where: {
        status: {
          in: [IssuedLicenseStatus.ISSUED, IssuedLicenseStatus.APPROVED],
        },
        managerUserId: caravan.managerUserId,
        caravanId: caravan.id,
        issuedAt: { gte: yearRange.gte, lt: yearRange.lt },
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        managerUserId: true,
        caravanId: true,
        organizationId: true,
        description: true,
        issuedAt: true,
        status: true,
        fileId: true,
        organization: { select: { id: true, name: true } },
        issuer: { select: userSelect },
      },
    });

    return {
      caravanId: caravan.id,
      managerUserId: caravan.managerUserId,
      items: items.map((item) => ({
        ...item,
        issuedAt: toDateOnly(item.issuedAt),
      })),
    };
  }

  async updatePermit(
    id: string,
    dto: UpdateReservationPermitDto,
    actor: Actor,
  ) {
    const current = await this.requireReservation(id);
    this.assertOwnerOrAdmin(current, actor);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    if (
      current.status === ReservationStatus.COMPLETED ||
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.REJECTED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (
      current.permitStatus === ReservationPermitStatus.APPROVED &&
      !isAdmin(actor)
    ) {
      throw new BadRequestException('مجوز کاروان تأیید شده و قابل تغییر نیست');
    }
    if (!current.caravanId || !current.caravanManagerId) {
      throw new BadRequestException('کاروان پرونده مشخص نیست');
    }

    const permit = await this.resolvePermitInput(
      {
        year: current.year,
        caravanId: current.caravanId,
        managerUserId: current.caravanManagerId,
        issuedLicenseId: dto.issuedLicenseId,
        permitImageId: dto.permitImageId,
      },
      { required: true },
    );

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...permit,
        hasPermit: false,
        permitStatus: ReservationPermitStatus.PENDING,
        permitReviewedAt: null,
        permitReviewedById: null,
        permitRejectionReason: null,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  async approvePermit(id: string, actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    if (
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.REJECTED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (
      current.permitStatus !== ReservationPermitStatus.PENDING &&
      current.permitStatus !== ReservationPermitStatus.REJECTED
    ) {
      if (current.permitStatus === ReservationPermitStatus.APPROVED) {
        return this.serialize(current, actor);
      }
      throw new BadRequestException('مجوز کاروان برای تأیید آماده نیست');
    }
    if (!current.issuedLicenseId && !current.permitImageId) {
      throw new BadRequestException('منبع مجوز کاروان مشخص نیست');
    }
    if (current.issuedLicenseId) {
      await this.assertIssuedLicenseForReservation({
        licenseId: current.issuedLicenseId,
        year: current.year,
        caravanId: current.caravanId!,
        managerUserId: current.caravanManagerId!,
      });
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        hasPermit: true,
        permitStatus: ReservationPermitStatus.APPROVED,
        permitReviewedAt: new Date(),
        permitReviewedById: actor.id,
        permitRejectionReason: null,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  async rejectPermit(
    id: string,
    dto: RejectReservationPermitDto | undefined,
    actor: Actor,
  ) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
    const current = await this.requireReservation(id);
    if (current.type !== ReservationType.CARAVAN) {
      throw new BadRequestException('این پرونده کاروانی نیست');
    }
    if (
      current.status === ReservationStatus.CANCELLED ||
      current.status === ReservationStatus.REJECTED ||
      current.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (current.permitStatus === ReservationPermitStatus.NONE) {
      throw new BadRequestException('مجوز کاروان برای رد آماده نیست');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        hasPermit: false,
        permitStatus: ReservationPermitStatus.REJECTED,
        permitReviewedAt: new Date(),
        permitReviewedById: actor.id,
        permitRejectionReason: dto?.reason?.trim() || null,
      },
      include: reservationInclude,
    });
    return this.serialize(updated, actor);
  }

  private async list(
    query: FindReservationsQueryDto,
    extraWhere?: Prisma.ReservationWhereInput,
  ) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const filters: Prisma.ReservationWhereInput[] = [];
    if (extraWhere) filters.push(extraWhere);
    const codeQuery = query.q ? normalizeReservationCode(query.q) : '';
    const searchingByCode = Boolean(query.q && isReservationCodeQuery(query.q));
    if (query.year && !searchingByCode) filters.push({ year: query.year });
    if (query.type) filters.push({ type: query.type });
    if (query.status === IN_PROGRESS_FILTER) {
      filters.push({ status: { in: IN_PROGRESS_STATUSES } });
    } else if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.countryId) {
      filters.push({
        OR: [
          { createdBy: { countryId: query.countryId } },
          { caravanManager: { countryId: query.countryId } },
          { originCity: { province: { countryId: query.countryId } } },
        ],
      });
    }
    if (query.walkingRouteId)
      filters.push({ walkingRouteId: query.walkingRouteId });
    if (query.originCityId) filters.push({ originCityId: query.originCityId });
    if (query.caravanId) filters.push({ caravanId: query.caravanId });
    if (query.caravanManagerId) {
      filters.push({ caravanManagerId: query.caravanManagerId });
    }
    if (query.createdFrom || query.createdTo) {
      filters.push({
        createdAt: {
          ...(query.createdFrom
            ? { gte: parseIsoDate(query.createdFrom) }
            : {}),
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
        { code: containsInsensitive(codeQuery || query.q) },
        { createdBy: { fullName: containsInsensitive(query.q) } },
        { createdBy: { nationalId: containsInsensitive(query.q) } },
        { originCity: { nameFa: containsInsensitive(query.q) } },
        { caravan: { name: containsInsensitive(query.q) } },
        { group: { name: containsInsensitive(query.q) } },
      ];
      if (codeQuery) {
        search.unshift({ code: codeQuery });
        if (codeQuery !== query.q.trim()) {
          search.unshift({ code: containsInsensitive(codeQuery) });
        }
      }
      if (isReservationId(query.q)) search.unshift({ id: query.q.trim() });
      const searchYear = parseSearchYear(query.q);
      if (searchYear) search.push({ year: searchYear });
      const searchType = matchSearchType(query.q);
      if (searchType) search.push({ type: searchType });
      filters.push({ OR: search });
    }
    const where = filters.length ? { AND: filters } : {};
    const orderBy =
      resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
        query.sortBy,
        query.sortDir,
        {
          code: (dir) => [{ year: dir }, { codeSeq: dir }],
          year: (dir) => ({ year: dir }),
          type: (dir) => ({ type: dir }),
          status: (dir) => ({ status: dir }),
          stayStartDate: (dir) => ({ stayStartDate: dir }),
          createdAt: (dir) => ({ createdAt: dir }),
          updatedAt: (dir) => ({ updatedAt: dir }),
          totalCount: (dir) => ({ totalCount: dir }),
          originCity: (dir) => ({ originCity: { nameFa: dir } }),
          createdBy: (dir) => ({ createdBy: { fullName: dir } }),
          caravan: (dir) => ({ caravan: { name: dir } }),
          caravanManager: (dir) => ({ caravanManager: { fullName: dir } }),
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

  private async requireReservation(
    id: string,
    tx: Tx | PrismaService = this.prisma,
  ) {
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

  private async requireEnabledSettings(year: number, type: ReservationType) {
    const settings = await this.prisma.receptionSettings.findUnique({
      where: { year },
    });
    if (!settings || !settings[settingsEnabledKey(type)]) {
      throw new BadRequestException('پذیرش این نوع در این سال فعال نیست');
    }
    return settings;
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

  private async originCityFromWalkingRoute(
    tx: Tx,
    walkingRouteId: string,
    originCityId?: string | null,
  ) {
    if (originCityId) return originCityId;
    const firstStage = await tx.walkingRouteStage.findFirst({
      where: { walkingRouteId },
      orderBy: { stageNumber: 'asc' },
      select: { cityId: true },
    });
    return firstStage?.cityId ?? null;
  }

  private async applicantCountryIso2(
    tx: Tx,
    current: Pick<ReservationRecord, 'createdById' | 'caravanManagerId'>,
  ) {
    const userId = current.caravanManagerId ?? current.createdById;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { country: { select: { iso2: true } } },
    });
    return user?.country?.iso2 ?? null;
  }

  private async isInternationalApplicant(
    tx: Tx,
    current: Pick<ReservationRecord, 'createdById' | 'caravanManagerId'>,
  ) {
    const iso2 = await this.applicantCountryIso2(tx, current);
    return Boolean(iso2 && iso2 !== 'IR');
  }

  private internationalCompletionPatch(now: Date, actorId: string) {
    return {
      status: ReservationStatus.COMPLETED,
      managementReviewedAt: now,
      managementReviewedById: actorId,
      basicInfoLockedAt: now,
      companionsCompletedAt: now,
      companionsCompletedById: actorId,
      caravanContactsCompletedAt: now,
      caravanContactsCompletedById: actorId,
      insuranceCompletedAt: now,
      insuranceCompletedById: actorId,
      completedAt: now,
      completedById: actorId,
    };
  }

  private async resolveCreatedById(
    createdById: string | null | undefined,
    actor: Actor,
  ) {
    if (!createdById) return actor.id;
    if (!isAdmin(actor)) {
      throw new ForbiddenException('امکان ایجاد پرونده به نیابت وجود ندارد');
    }
    if (createdById === actor.id) return actor.id;
    const owner = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { id: true },
    });
    if (!owner) {
      throw new BadRequestException('کاربر انتخاب‌شده معتبر نیست');
    }
    return owner.id;
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

  private async resolveGroup(
    dto: {
      type: ReservationType;
      groupId?: string | null;
    },
    actor: Actor,
  ) {
    if (dto.type !== ReservationType.GROUP) {
      if (dto.groupId) {
        throw new BadRequestException('این پرونده گروهی نیست');
      }
      return null;
    }
    if (!dto.groupId) {
      return null;
    }
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
    });
    if (!group) {
      throw new BadRequestException('گروه انتخاب‌شده معتبر نیست');
    }
    if (
      !isAdmin(actor) &&
      group.managerUserId &&
      group.managerUserId !== actor.id
    ) {
      throw new ForbiddenException('امکان استفاده از این گروه وجود ندارد');
    }
    return { id: group.id, managerUserId: group.managerUserId };
  }

  private async submitDraft(tx: Tx, current: ReservationRecord, actor: Actor) {
    this.assertOwnerOrAdmin(current, actor);
    if (current.status !== ReservationStatus.DRAFT) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
    if (current.basicInfoLockedAt) {
      throw new BadRequestException('پرونده قفل است');
    }
    const requestedMale = current.requestedMaleCount || current.maleCount;
    const requestedFemale = current.requestedFemaleCount || current.femaleCount;
    this.assertCounts(requestedMale, requestedFemale);
    this.assertTripDates(
      toDateOnly(current.walkingStartDate),
      toDateOnly(current.stayStartDate),
      toDateOnly(current.stayEndDate),
    );
    if (!current.walkingRouteId) {
      throw new BadRequestException('مسیر پیاده‌روی را انتخاب کنید');
    }
    const originCityId = await this.originCityFromWalkingRoute(
      tx,
      current.walkingRouteId,
      current.originCityId,
    );
    if (current.type === ReservationType.CARAVAN && !current.caravanId) {
      throw new BadRequestException(
        'این پرونده کاروانی نیست یا کاروان انتخاب نشده است',
      );
    }
    if (current.type === ReservationType.GROUP && !current.groupId) {
      throw new BadRequestException('گروه را انتخاب کنید');
    }
    const international = await this.isInternationalApplicant(tx, current);
    const waivePermit =
      current.type === ReservationType.CARAVAN && international;
    if (
      current.type === ReservationType.CARAVAN &&
      !waivePermit &&
      !current.issuedLicenseId &&
      !current.permitImageId
    ) {
      throw new BadRequestException(
        'مجوز کاروان را از فهرست سازمانی انتخاب کنید یا تصویر مجوز را بارگذاری کنید',
      );
    }
    if (current.type === ReservationType.CARAVAN && !waivePermit && current.issuedLicenseId) {
      const license = await tx.issuedLicense.findUnique({
        where: { id: current.issuedLicenseId },
        select: { status: true },
      });
      if (!license || license.status === IssuedLicenseStatus.REVOKED) {
        throw new BadRequestException('مجوز سازمانی انتخاب‌شده معتبر نیست');
      }
      if (license.status === IssuedLicenseStatus.ISSUED) {
        throw new BadRequestException(
          'برای ثبت نهایی پرونده باید منتظر تأیید مجوز از طرف مدیریت ستاد باشید',
        );
      }
    }

    const settings = await this.requireSettings(current.year, tx);
    if (!settings[settingsEnabledKey(current.type)]) {
      throw new BadRequestException('پذیرش این نوع در این سال فعال نیست');
    }

    const autoApprove =
      international || settings[settingsAutoApproveKey(current.type)];
    const next = international
      ? ReservationStatus.COMPLETED
      : nextAfterBasicInfo(current.type, autoApprove);
    const now = new Date();
    const systemUserId = autoApprove ? await this.systemUserId(tx) : null;
    const stampUserId = systemUserId ?? actor.id;

    if (autoApprove) {
      await assertCapacity(
        tx,
        settings,
        current.type,
        current.year,
        requestedMale,
        requestedFemale,
        current.id,
      );
    }

    if (current.type === ReservationType.INDIVIDUAL && !international) {
      await this.ensureApplicantMember(tx, current);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: next,
        basicInfoCompletedAt: now,
        basicInfoCompletedById: actor.id,
        createWizardStep: null,
        originCityId,
        ...(waivePermit
          ? {
              hasPermit: true,
              permitStatus: ReservationPermitStatus.APPROVED,
              permitReviewedAt: now,
              permitReviewedById: actor.id,
              permitRejectionReason: null,
            }
          : {}),
        ...(international
          ? {
              ...this.internationalCompletionPatch(now, stampUserId),
              maleCount: requestedMale,
              femaleCount: requestedFemale,
              totalCount: requestedMale + requestedFemale,
              placementStatus: PlacementStatus.NOT_REQUIRED,
              placementCompletedAt: null,
              placementCompletedById: null,
            }
          : autoApprove
            ? {
                managementReviewedAt: now,
                managementReviewedById: systemUserId,
                basicInfoLockedAt: now,
                maleCount: requestedMale,
                femaleCount: requestedFemale,
                totalCount: requestedMale + requestedFemale,
              }
            : unapprovedCounts()),
      },
      include: reservationInclude,
    });
    if (autoApprove) {
      await this.syncPartyCapacity(tx, {
        type: current.type,
        groupId: current.groupId,
        caravanId: current.caravanId,
        maleCount: requestedMale,
        femaleCount: requestedFemale,
        year: current.year,
        updateYear: true,
      });
    }
    if (international) {
      this.emitWorkflowEvent('complete', current.id, stampUserId);
    }
    return this.serialize(updated, actor);
  }

  private async ensureApplicantMember(
    tx: Tx,
    reservation: Pick<ReservationRecord, 'id' | 'createdById' | 'members'>,
  ) {
    if (
      reservation.members.some(
        (item) => item.userId === reservation.createdById,
      )
    ) {
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
    const nationalId = dto.nationalId?.trim() || '';
    const passport = dto.passportNumber?.trim() || '';
    if (nationalId) {
      const existing = await this.users.findByIdentity({ nationalId });
      if (existing.found) {
        return { user: existing.user };
      }
    }
    if (passport) {
      const existing = await this.users.findByIdentity({ nationalId: passport });
      if (existing.found) {
        return { user: existing.user };
      }
    }
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('نام و نام خانوادگی همراه لازم است');
    }
    if (options?.requireGender !== false && !dto.gender) {
      throw new BadRequestException('جنسیت همراه لازم است');
    }
    return this.users.findOrCreatePilgrim({
      nationalId: nationalId || passport || null,
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

  private assertOccasionDates(
    prophetDemiseDate?: string | null,
    imamRezaMartyrdomDate?: string | null,
  ) {
    if (!prophetDemiseDate && !imamRezaMartyrdomDate) {
      return;
    }
    if (
      !prophetDemiseDate ||
      !imamRezaMartyrdomDate ||
      imamRezaMartyrdomDate !== addDaysIso(prophetDemiseDate, 1)
    ) {
      throw new BadRequestException(
        'تاریخ شهادت امام رضا (ع) باید یک روز بعد از رحلت حضرت رسول اکرم (ص) باشد.',
      );
    }
  }

  private resolveApprovedCounts(
    current: Pick<
      ReservationRecord,
      'type' | 'requestedMaleCount' | 'requestedFemaleCount'
    >,
    dto?: Pick<ApproveReservationDto, 'maleCount' | 'femaleCount'>,
  ) {
    const maleCount = dto?.maleCount ?? current.requestedMaleCount;
    const femaleCount = dto?.femaleCount ?? current.requestedFemaleCount;
    this.assertCounts(maleCount, femaleCount);
    this.assertGroupSize(current.type, maleCount, femaleCount);
    return { maleCount, femaleCount };
  }

  private async syncPartyCapacity(
    tx: Tx,
    params: {
      type: ReservationType;
      groupId?: string | null;
      caravanId?: string | null;
      maleCount: number;
      femaleCount: number;
      year?: number;
      updateYear?: boolean;
    },
  ) {
    const { type, groupId, caravanId, maleCount, femaleCount, year, updateYear } = params;
    const totalCount = maleCount + femaleCount;
    if (type === ReservationType.GROUP && groupId) {
      await tx.group.update({
        where: { id: groupId },
        data: { maleCount, femaleCount, totalCount },
      });
      return;
    }
    if (type === ReservationType.CARAVAN && caravanId) {
      await tx.caravan.update({
        where: { id: caravanId },
        data: { maleCount, femaleCount, totalCount },
      });
      const yearRow =
        updateYear && year
          ? await tx.caravanYear.findUnique({
              where: { caravanId_year: { caravanId, year } },
              select: { id: true },
            })
          : null;
      if (yearRow) {
        await tx.caravanYear.update({
          where: { id: yearRow.id },
          data: { maleCount, femaleCount },
        });
      }
    }
  }

  private resolveDraftPartyId(
    draftSoft: boolean,
    incoming: string | null | undefined,
    current: string | null,
  ) {
    if (incoming === undefined) return current;
    if (draftSoft && !incoming && current) return current;
    return incoming;
  }

  private assertCounts(maleCount: number, femaleCount: number) {
    if (maleCount < 0 || femaleCount < 0 || maleCount + femaleCount <= 0) {
      throw new BadRequestException('تعداد مرد و زن باید معتبر باشد');
    }
  }

  private assertDraftOrFullCounts(
    asDraft: boolean,
    maleCount: number,
    femaleCount: number,
  ) {
    if (maleCount < 0 || femaleCount < 0) {
      throw new BadRequestException('تعداد مرد و زن باید معتبر باشد');
    }
    if (!asDraft || maleCount + femaleCount > 0) {
      this.assertCounts(maleCount, femaleCount);
    }
  }

  private async assertInternationalCaravanOnly(
    userId: string,
    type: ReservationType,
  ) {
    if (type === ReservationType.CARAVAN) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: { select: { iso2: true } } },
    });
    if (user?.country?.iso2 && user.country.iso2 !== 'IR') {
      throw new BadRequestException(
        'زائران غیر ایرانی فقط به‌صورت کاروانی پذیرش می‌شوند',
      );
    }
  }

  private assertGroupSize(
    type: ReservationType,
    maleCount: number,
    femaleCount: number,
  ) {
    if (
      type === ReservationType.GROUP &&
      maleCount + femaleCount > GROUP_MAX_SIZE
    ) {
      throw new BadRequestException(
        `ظرفیت گروه حداکثر ${GROUP_MAX_SIZE} نفر است`,
      );
    }
  }

  private assertTripDates(
    walkingStart?: string | null,
    stayStart?: string | null,
    stayEnd?: string | null,
  ) {
    if (!stayStart) {
      throw new BadRequestException('تاریخ رسیدن به مشهد مقدس را وارد کنید');
    }
    if (!stayEnd) {
      throw new BadRequestException('تاریخ پایان اقامت را وارد کنید');
    }
    if (walkingStart && stayStart && stayStart <= walkingStart) {
      throw new BadRequestException(
        'تاریخ شروع پیاده‌روی باید قبل از تاریخ رسیدن به مشهد باشد',
      );
    }
    if (stayStart && stayEnd && stayEnd <= stayStart) {
      throw new BadRequestException(
        'تاریخ پایان اقامت باید بعد از تاریخ رسیدن به مشهد باشد',
      );
    }
  }

  private assertDraftOrFullTripDates(
    asDraft: boolean,
    walkingStart?: string | null,
    stayStart?: string | null,
    stayEnd?: string | null,
  ) {
    if (!asDraft) {
      this.assertTripDates(walkingStart, stayStart, stayEnd);
      return;
    }
    if (stayStart && stayEnd) {
      this.assertTripDates(walkingStart, stayStart, stayEnd);
      return;
    }
    if (walkingStart && stayStart && stayStart <= walkingStart) {
      throw new BadRequestException(
        'تاریخ شروع پیاده‌روی باید قبل از تاریخ رسیدن به مشهد باشد',
      );
    }
  }

  private assertNoLockedFieldChange(dto: UpdateReservationDto, locked = false) {
    if (!locked) return;
    for (const field of LOCKED_FIELDS) {
      if (dto[field] !== undefined) {
        throw new BadRequestException('پرونده قفل است');
      }
    }
  }

  private summarizeInsurance(members: ReservationRecord['members']) {
    const pending = members.filter(
      (item) =>
        item.insuranceStatus === ReservationMemberInsuranceStatus.PENDING,
    ).length;
    const paid = members.filter(
      (item) => item.insuranceStatus === ReservationMemberInsuranceStatus.PAID,
    ).length;
    const approved = members.filter(
      (item) =>
        item.insuranceStatus === ReservationMemberInsuranceStatus.APPROVED,
    ).length;
    const rejected = members.filter(
      (item) =>
        item.insuranceStatus === ReservationMemberInsuranceStatus.REJECTED,
    ).length;
    return {
      total: members.length,
      pending,
      paid: 0,
      approved: paid + approved,
      rejected,
      completed: members.length > 0 && pending === 0 && rejected === 0,
    };
  }

  private async requireInsurancePlan(year: number, planId?: string | null) {
    if (!planId) {
      throw new BadRequestException('پوشش بیمه را انتخاب کنید');
    }
    const plan = await this.prisma.receptionInsurancePlan.findFirst({
      where: { id: planId, year },
    });
    if (!plan) {
      throw new BadRequestException('پوشش بیمه معتبر نیست');
    }
    return plan;
  }

  private async markMembersPaid(
    tx: Tx,
    reservation: ReservationRecord,
    memberIds: string[],
    insurancePlanId: string,
    actor: Actor,
  ) {
    const uniqueIds = [...new Set(memberIds)];
    const payable = uniqueIds
      .map((memberId) => {
        const member = reservation.members.find((item) => item.id === memberId);
        if (!member) {
          throw new NotFoundException('عضو پرونده یافت نشد');
        }
        return member;
      })
      .filter((member) => INSURANCE_PAYABLE.includes(member.insuranceStatus));

    if (!payable.length) {
      throw new BadRequestException('عضوی برای پرداخت بیمه انتخاب نشده است');
    }

    const plan = await tx.receptionInsurancePlan.findFirst({
      where: { id: insurancePlanId, year: reservation.year },
    });
    if (!plan) {
      throw new BadRequestException('پوشش بیمه معتبر نیست');
    }
    const now = new Date();
    await tx.reservationMember.updateMany({
      where: {
        id: { in: payable.map((item) => item.id) },
        reservationId: reservation.id,
      },
      data: {
        insuranceStatus: ReservationMemberInsuranceStatus.APPROVED,
        insurancePaidAt: now,
        insurancePaidAmount: plan.premiumAmount,
        insuranceCoverageAmount: plan.coverageAmount,
        insurancePlanId: plan.id,
        insurancePaidMethod: isAdmin(actor)
          ? ReservationMemberInsurancePaidMethod.MANAGEMENT
          : ReservationMemberInsurancePaidMethod.ONLINE_GATEWAY,
        insurancePaidById: actor.id,
        insuranceManualNote: null,
        insuranceVerifiedAt: now,
        insuranceVerifiedById: actor.id,
      },
    });
  }

  private memberCountsMatch(current: ReservationRecord) {
    if (current.type === ReservationType.INDIVIDUAL) {
      return current.members.length === current.totalCount;
    }
    const male = current.members.filter(
      (item) => item.user.gender === UserGender.MALE,
    ).length;
    const female = current.members.filter(
      (item) => item.user.gender === UserGender.FEMALE,
    ).length;
    return male === current.maleCount && female === current.femaleCount;
  }

  private async finishReservation(
    tx: Tx,
    current: ReservationRecord,
    actor: Actor,
  ) {
    const now = new Date();
    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: ReservationStatus.COMPLETED,
        insuranceCompletedAt: current.insuranceCompletedAt ?? now,
        insuranceCompletedById: current.insuranceCompletedById ?? actor.id,
        completedAt: now,
        completedById: actor.id,
        placementStatus: current.requestsAccommodation
          ? PlacementStatus.PENDING
          : PlacementStatus.NOT_REQUIRED,
        placementCompletedAt: null,
        placementCompletedById: null,
      },
      include: reservationInclude,
    });
    this.emitWorkflowEvent('complete', current.id, actor.id);
    return this.serialize(updated, actor);
  }

  private assertCompanionsReady(current: ReservationRecord) {
    if (current.members.some((item) => !item.user.gender)) {
      throw new BadRequestException('جنسیت همه اعضا باید مشخص باشد');
    }
    if (!this.memberCountsMatch(current)) {
      throw new BadRequestException(
        'تعداد اعضای مرد و زن با تعداد اعلام‌شده پرونده سازگار نیست',
      );
    }
  }

  private assertContactsReady(current: ReservationRecord) {
    const roles = new Set(current.caravanContacts.map((item) => item.role));
    const missing = CARAVAN_CONTACT_ROLES.filter(
      (role) => !roles.has(role as CaravanContactRole),
    );
    if (missing.length) {
      throw new BadRequestException('همه رابطین کاروان باید تعیین شوند');
    }
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
    if (current.type !== ReservationType.INDIVIDUAL) {
      this.assertCompanionsReady(current);
    } else if (!this.memberCountsMatch(current)) {
      throw new BadRequestException(
        'تعداد مرد و زن ثبت‌شده با پرونده هم‌خوان نیست',
      );
    }
    if (current.type === ReservationType.CARAVAN) {
      this.assertContactsReady(current);
      if (
        !current.hasPermit ||
        current.permitStatus !== ReservationPermitStatus.APPROVED
      ) {
        throw new BadRequestException(
          'تا تأیید مجوز کاروان امکان ثبت نهایی پرونده وجود ندارد',
        );
      }
    }
  }

  private emitWorkflowEvent(
    event: 'complete' | 'reject' | 'return' | 'cancel',
    reservationId: string,
    actorId: string,
  ) {
    this.logger.log(
      `reservation.workflow ${event} ${reservationId} ${actorId}`,
    );
  }

  private async resolvePermitInput(
    input: {
      year: number;
      caravanId: string;
      managerUserId: string | null;
      issuedLicenseId?: string | null;
      permitImageId?: string | null;
    },
    options: { required: boolean },
  ) {
    const issuedLicenseId = input.issuedLicenseId ?? null;
    const permitImageId = input.permitImageId ?? null;
    if (issuedLicenseId && permitImageId) {
      throw new BadRequestException(
        'فقط یکی از مجوز سازمانی یا تصویر مجوز را انتخاب کنید',
      );
    }
    if (!issuedLicenseId && !permitImageId) {
      if (options.required) {
        throw new BadRequestException(
          'مجوز کاروان را از فهرست سازمانی انتخاب کنید یا تصویر مجوز را بارگذاری کنید',
        );
      }
      return emptyPermitData();
    }
    if (!input.managerUserId) {
      throw new BadRequestException('مدیر کاروان مشخص نیست');
    }

    if (issuedLicenseId) {
      await this.assertIssuedLicenseForReservation({
        licenseId: issuedLicenseId,
        year: input.year,
        caravanId: input.caravanId,
        managerUserId: input.managerUserId,
        requireApproved: false,
      });
      return {
        hasPermit: false,
        permitStatus: ReservationPermitStatus.PENDING,
        permitSource: ReservationPermitSource.ISSUED_LICENSE,
        issuedLicenseId,
        permitImageId: null as string | null,
        permitReviewedAt: null as Date | null,
        permitReviewedById: null as string | null,
        permitRejectionReason: null as string | null,
      };
    }

    await this.assertPermitImage(permitImageId);
    return {
      hasPermit: false,
      permitStatus: ReservationPermitStatus.PENDING,
      permitSource: ReservationPermitSource.UPLOAD,
      issuedLicenseId: null as string | null,
      permitImageId,
      permitReviewedAt: null as Date | null,
      permitReviewedById: null as string | null,
      permitRejectionReason: null as string | null,
    };
  }

  private async assertIssuedLicenseForReservation(input: {
    licenseId: string;
    year: number;
    caravanId: string;
    managerUserId: string;
    /** When false, ISSUED (awaiting HQ) licenses may be attached to a draft. */
    requireApproved?: boolean;
  }) {
    const requireApproved = input.requireApproved !== false;
    const license = await this.prisma.issuedLicense.findUnique({
      where: { id: input.licenseId },
      select: {
        id: true,
        status: true,
        managerUserId: true,
        caravanId: true,
        issuedAt: true,
      },
    });
    if (!license) {
      throw new BadRequestException('مجوز سازمانی انتخاب‌شده معتبر نیست');
    }
    if (license.status === IssuedLicenseStatus.REVOKED) {
      throw new BadRequestException('این مجوز سازمانی ابطال شده است');
    }
    const statusOk = requireApproved
      ? license.status === IssuedLicenseStatus.APPROVED
      : license.status === IssuedLicenseStatus.APPROVED ||
        license.status === IssuedLicenseStatus.ISSUED;
    if (!statusOk) {
      throw new BadRequestException('این مجوز هنوز توسط مدیریت تأیید نشده است');
    }
    if (license.managerUserId !== input.managerUserId) {
      throw new BadRequestException(
        'مجوز سازمانی متعلق به مدیر این کاروان نیست',
      );
    }
    if (license.caravanId !== input.caravanId) {
      throw new BadRequestException('مجوز سازمانی متعلق به این کاروان نیست');
    }
    const yearRange = jalaliYearRange(input.year);
    if (license.issuedAt < yearRange.gte || license.issuedAt >= yearRange.lt) {
      throw new BadRequestException(
        'سال صدور مجوز سازمانی با سال پرونده زیارتی هم‌خوان نیست',
      );
    }
  }

  private async assertPermitImage(fileId?: string | null) {
    if (!fileId) {
      throw new BadRequestException('تصویر مجوز را بارگذاری کنید');
    }
    const image = await this.prisma.storedImage.findUnique({
      where: { id: fileId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('تصویر مجوز معتبر نیست');
    }
  }

  private assertOwnerOrAdmin(reservation: ReservationRecord, actor: Actor) {
    if (isAdmin(actor)) return;
    if (
      reservation.createdById === actor.id ||
      reservation.caravanManagerId === actor.id
    ) {
      return;
    }
    throw new ForbiddenException(
      'امکان انجام این عملیات روی این پرونده وجود ندارد',
    );
  }

  private assertCanView(reservation: ReservationRecord, actor: Actor) {
    if (isAdmin(actor)) return;
    if (
      reservation.createdById === actor.id ||
      reservation.caravanManagerId === actor.id ||
      this.isHonoraryAssignee(reservation, actor.id)
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
      reservation.caravanManagerId === actor.id ||
      this.isHonoraryAssignee(reservation, actor.id)
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

  private assertNotCancelled(reservation: ReservationRecord) {
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
  }

  private assertWorkflowStatus(
    reservation: ReservationRecord,
    actor: Actor,
    allowed: ReservationStatus | ReservationStatus[],
  ) {
    if (isAdmin(actor)) {
      this.assertNotCancelled(reservation);
      return;
    }
    const statuses = Array.isArray(allowed) ? allowed : [allowed];
    if (!statuses.includes(reservation.status)) {
      throw new BadRequestException('پرونده در وضعیت مناسب این عملیات نیست');
    }
  }

  private assertCountsCoverMembers(
    reservation: ReservationRecord,
    maleCount: number,
    femaleCount: number,
  ) {
    const registeredMale = reservation.members.filter(
      (item) => item.user.gender === UserGender.MALE,
    ).length;
    const registeredFemale = reservation.members.filter(
      (item) => item.user.gender === UserGender.FEMALE,
    ).length;
    if (maleCount < registeredMale || femaleCount < registeredFemale) {
      throw new BadRequestException(
        'تعداد نمی‌تواند کمتر از همراهان ثبت‌شده باشد',
      );
    }
  }

  private assertCompanionsStatus(reservation: ReservationRecord, actor: Actor) {
    this.assertWorkflowStatus(
      reservation,
      actor,
      companionEditStatuses(reservation.type),
    );
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
      throw new BadRequestException(
        'جنسیت همه افراد انتخاب‌شده باید مشخص باشد',
      );
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

  private previousCaravanWhere(
    current: ReservationRecord,
  ): Prisma.ReservationWhereInput {
    return {
      type: ReservationType.CARAVAN,
      id: { not: current.id },
      status: { not: ReservationStatus.CANCELLED },
      members: { some: {} },
      ...(current.caravanId
        ? { caravanId: current.caravanId }
        : { createdById: current.createdById }),
    };
  }

  private findPreviousCaravanReservations(current: ReservationRecord) {
    return this.prisma.reservation.findMany({
      where: this.previousCaravanWhere(current),
      orderBy: [
        { year: 'desc' },
        { stayStartDate: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        code: true,
        year: true,
        status: true,
        stayStartDate: true,
        stayEndDate: true,
        originCity: { select: { nameFa: true, nameEn: true } },
        members: {
          select: {
            userId: true,
            user: { select: { gender: true } },
          },
        },
      },
    });
  }

  private findPreviousCaravanReservationSource(
    current: ReservationRecord,
    sourceReservationId: string,
    db: Tx | PrismaService = this.prisma,
  ) {
    return db.reservation.findFirst({
      where: {
        id: sourceReservationId,
        type: ReservationType.CARAVAN,
        status: { not: ReservationStatus.CANCELLED },
        ...(current.caravanId
          ? { caravanId: current.caravanId }
          : { createdById: current.createdById }),
      },
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
      maleCount: importable.filter((row) => row.gender === UserGender.MALE)
        .length,
      femaleCount: importable.filter((row) => row.gender === UserGender.FEMALE)
        .length,
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
          if (code === 'missingFirstName' || code === 'missingLastName')
            return false;
          if (
            (code === 'missingGender' || code === 'invalidGender') &&
            user.gender
          ) {
            return false;
          }
          return true;
        })
      : [...row.errors];
    if (
      user &&
      !user.gender &&
      !row.gender &&
      !errors.includes('missingGender')
    ) {
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
      placementStatus: PlacementStatus.NOT_REQUIRED,
      placementCompletedAt: null,
      placementCompletedById: null,
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
    if (status === ReservationStatus.PENDING_MANAGEMENT_REVIEW) {
      return {
        ...base,
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

  private async nextReservationCode(tx: Tx, year: number) {
    const items = await tx.reservation.findMany({
      where: { year },
      select: { code: true },
    });
    return nextSequentialReservationCode(
      year,
      items.map((item) => item.code),
    );
  }

  private async withCodeConflictRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!conflict || attempt === 7) {
          throw error;
        }
      }
    }
    throw new BadRequestException('امکان صدور کد یکتای پرونده نبود');
  }

  private isHonoraryAssignee(reservation: ReservationRecord, userId: string) {
    return reservation.honoraryAssignments.some((item) => item.userId === userId);
  }

  private serializeHonoraryAssignment(
    item: ReservationRecord['honoraryAssignments'][number],
  ) {
    return {
      id: item.id,
      user: item.user,
      serviceType: item.serviceType,
      assignedBy: item.assignedBy,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private serializeListItem(row: ReservationRecord) {
    return {
      id: row.id,
      code: row.code,
      year: row.year,
      type: row.type,
      status: row.status,
      placementMode: row.placementMode,
      placementStatus: row.placementStatus,
      originCity: row.originCity,
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      caravanId: row.caravanId,
      groupId: row.groupId,
      caravan: row.caravan,
      group: row.group,
      createdBy: row.createdBy,
      caravanManager: row.caravanManager,
      honoraryAssignments: row.honoraryAssignments.map((item) =>
        this.serializeHonoraryAssignment(item),
      ),
      hasPermit: row.hasPermit,
      permitStatus: row.permitStatus,
      permitSource: row.permitSource,
      returnedToStatus: row.returnedToStatus,
      createWizardStep: row.createWizardStep,
      walkingRoute: row.walkingRoute,
      internationalWorkflow: isInternationalWorkflowRow(row),
      iraqiWorkflow: isIraqiWorkflowRow(row),
    };
  }

  private serialize(row: ReservationRecord, actor: Actor) {
    const admin = isAdmin(actor);
    const seeMembers = this.canSeeMembers(row, actor);
    return {
      id: row.id,
      createdBy: row.createdBy,
      code: row.code,
      year: row.year,
      type: row.type,
      status: row.status,
      placementMode: row.placementMode,
      placementStatus: row.placementStatus,
      placementCompletedAt: row.placementCompletedAt?.toISOString() ?? null,
      createWizardStep: row.createWizardStep,
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
      simCardNumber: row.simCardNumber,
      simCardOperator: row.simCardOperator,
      simCardDeliveredAt: toDateOnly(row.simCardDeliveredAt),
      simCardInitialCharge: row.simCardInitialCharge,
      bankCardNumber: row.bankCardNumber,
      bankCardIban: row.bankCardIban,
      bankCardBank: row.bankCardBank,
      bankCardDeliveredAt: toDateOnly(row.bankCardDeliveredAt),
      bankCardInitialBalance: row.bankCardInitialBalance,
      requestedMaleCount: row.requestedMaleCount,
      requestedFemaleCount: row.requestedFemaleCount,
      maleCount: row.maleCount,
      femaleCount: row.femaleCount,
      totalCount: row.totalCount,
      caravanId: row.caravanId,
      groupId: row.groupId,
      caravan: row.caravan,
      group: row.group,
      caravanManager: row.caravanManager,
      honoraryAssignments: row.honoraryAssignments.map((item) =>
        this.serializeHonoraryAssignment(item),
      ),
      hasPermit: row.hasPermit,
      permitStatus: row.permitStatus,
      permitSource: row.permitSource,
      permitImageId: row.permitImageId,
      issuedLicenseId: row.issuedLicenseId,
      issuedLicense: row.issuedLicense
        ? {
            ...row.issuedLicense,
            issuedAt: toDateOnly(row.issuedLicense.issuedAt),
          }
        : null,
      permitReviewedAt: row.permitReviewedAt?.toISOString() ?? null,
      permitReviewedBy: row.permitReviewedBy,
      permitRejectionReason:
        admin || seeMembers ? row.permitRejectionReason : null,
      caravanManagerNotes: seeMembers ? row.caravanManagerNotes : null,
      managementNotes: admin ? row.managementNotes : null,
      rejectionReason: admin || seeMembers ? row.rejectionReason : null,
      basicInfoLockedAt: row.basicInfoLockedAt?.toISOString() ?? null,
      basicInfoCompletedAt: row.basicInfoCompletedAt?.toISOString() ?? null,
      managementReviewedAt: row.managementReviewedAt?.toISOString() ?? null,
      companionsCompletedAt: row.companionsCompletedAt?.toISOString() ?? null,
      caravanContactsCompletedAt:
        row.caravanContactsCompletedAt?.toISOString() ?? null,
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
      placementCompletedBy: row.placementCompletedBy,
      rejectedBy: row.rejectedBy,
      cancelledBy: row.cancelledBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      internationalWorkflow: isInternationalWorkflowRow(row),
      iraqiWorkflow: isIraqiWorkflowRow(row),
      members: seeMembers
        ? row.members.map((item) => this.serializeMember(item))
        : undefined,
      caravanContacts: seeMembers
        ? row.caravanContacts.map((item) => this.serializeContact(item))
        : undefined,
      allocations: row.allocations.map((item) => ({
        id: item.id,
        accommodationId: item.accommodationId,
        accommodation: this.serializeStayAccommodation(item.accommodation),
        gender: item.gender,
        headcount: item.headcount,
        source: item.source,
        genderOverride: item.genderOverride,
        overrideNote: item.overrideNote,
        placedAt: item.placedAt.toISOString(),
        placedBy: item.placedBy,
      })),
    };
  }

  private serializeStayAccommodation(
    item: ReservationRecord['allocations'][number]['accommodation'],
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
      insuranceCoverageAmount: item.insuranceCoverageAmount,
      insurancePlanId: item.insurancePlanId,
      insurancePaymentRef: item.insurancePaymentRef,
      insurancePaidMethod: item.insurancePaidMethod,
      insurancePaidById: item.insurancePaidById,
      insurancePaidBy: item.insurancePaidBy
        ? {
            ...item.insurancePaidBy,
            birthDate: toDateOnly(item.insurancePaidBy.birthDate),
          }
        : null,
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

function optionalTrimmed(value?: string | null) {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function optionalDigits(value?: string | null) {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  const digits = toLatinDigits(value).replace(/\D/g, '');
  return digits.length ? digits : null;
}

function optionalIban(value?: string | null) {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  const normalized = toLatinDigits(value).replace(/\s/g, '').toUpperCase();
  return normalized.length ? normalized : null;
}

function issuedServicesPatch(
  dto: UpdateReservationDto,
): Prisma.ReservationUncheckedUpdateInput {
  return {
    simCardNumber: optionalDigits(dto.simCardNumber),
    simCardOperator: optionalTrimmed(dto.simCardOperator),
    simCardDeliveredAt: parseOptionalIsoDate(dto.simCardDeliveredAt),
    simCardInitialCharge:
      dto.simCardInitialCharge === undefined
        ? undefined
        : dto.simCardInitialCharge,
    bankCardNumber: optionalDigits(dto.bankCardNumber),
    bankCardIban: optionalIban(dto.bankCardIban),
    bankCardBank: optionalTrimmed(dto.bankCardBank),
    bankCardDeliveredAt: parseOptionalIsoDate(dto.bankCardDeliveredAt),
    bankCardInitialBalance:
      dto.bankCardInitialBalance === undefined
        ? undefined
        : dto.bankCardInitialBalance,
  };
}

function isIraqiWorkflowRow(row: {
  createdBy?: { country?: { iso2?: string | null } | null } | null;
  caravanManager?: { country?: { iso2?: string | null } | null } | null;
}) {
  const iso2 = row.caravanManager?.country?.iso2 ?? row.createdBy?.country?.iso2;
  return iso2 === 'IQ';
}

function isInternationalWorkflowRow(row: {
  createdBy?: { country?: { iso2?: string | null } | null } | null;
  caravanManager?: { country?: { iso2?: string | null } | null } | null;
}) {
  const iso2 = row.caravanManager?.country?.iso2 ?? row.createdBy?.country?.iso2;
  return Boolean(iso2 && iso2 !== 'IR');
}

function emptyPermitData() {
  return {
    hasPermit: false,
    permitStatus: ReservationPermitStatus.NONE,
    permitSource: null as ReservationPermitSource | null,
    issuedLicenseId: null as string | null,
    permitImageId: null as string | null,
    permitReviewedAt: null as Date | null,
    permitReviewedById: null as string | null,
    permitRejectionReason: null as string | null,
  };
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
