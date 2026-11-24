import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isAccommodationManager, isAdmin } from '../auth/roles.util';
import { SmsService } from '../sms/sms.service';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear } from '../common/jalali-year';
import { localizedGeoName } from '../common/request-locale';
import {
  ACCOMMODATION_UNAVAILABLE_STATUSES,
  isAccommodationUnavailable,
} from '../common/accommodation-availability';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import {
  Prisma,
  AccommodationInspectionResult,
  AccommodationInspectionStatus,
  AccommodationOperationStatus,
  AccommodationStatus,
  AllocationStatus,
  ReservationType,
  UserGender,
  type GenderType,
  type ManagementType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { PublicIntroduceAccommodationDto } from './dto/public-introduce-accommodation.dto';
import {
  FindAccommodationAssignmentsQueryDto,
  type AssignmentManagerFilter,
} from './dto/find-accommodation-assignments-query.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import {
  parseIsoDate,
  parseOptionalIsoDate,
  toIsoDateOnly,
  todayIsoDateTehran,
} from '../common/iso-date';
import { resolveSortOrder } from '../common/sort-query';
import { effectiveCapacity } from '../placements/placement-capacity';
import type { AccommodationContactInputDto } from './dto/accommodation-contact-input.dto';
import {
  accommodationTypeDetailKeys,
  accommodationTypeDetailKind,
  isSchoolAccommodationType,
  typeDetailImageKeys,
  typeDetailKeysByKind,
  typeDetailKeysToClear,
} from './accommodation-type-details';

const MAX_ACCOMMODATION_IMAGES = 12;
const reviewerSelect = { id: true, username: true, fullName: true } as const;

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
  schoolDistrict: { select: { id: true, name: true } },
  schoolManagerUser: { select: { id: true, username: true, fullName: true } },
  type: {
    select: {
      id: true,
      code: true,
      nameFa: true,
      nameEn: true,
      icon: true,
      isActive: true,
      sortOrder: true,
    },
  },
  reviewer: { select: reviewerSelect },
  images: {
    orderBy: { sortOrder: 'asc' as const },
    select: { imageId: true, sortOrder: true },
  },
  evaluations: {
    orderBy: [{ evaluatedAt: 'desc' as const }, { createdAt: 'desc' as const }],
    include: { reviewer: { select: reviewerSelect } },
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
  private readonly logger = new Logger(AccommodationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sms: SmsService,
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

  async findIntroduced(query: FindAccommodationsQueryDto, actor: Actor) {
    const where = this.andWhere(
      this.listWhere(query, { id: actor.id, userRoles: [] }, { unscoped: true }),
      { introducedById: actor.id },
    );
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

  async findAll(query: FindAccommodationsQueryDto, actor: Actor) {
    const viewer = this.isDirectoryViewer(actor);
    const where = viewer
      ? this.andWhere(this.listWhere(query, actor, { unscoped: true }), {
          OR: [
            { status: { notIn: ACCOMMODATION_UNAVAILABLE_STATUSES } },
            { managers: { some: { userId: actor.id } } },
          ],
        })
      : this.listWhere(query, actor);
    const findMany = {
      where,
      orderBy: this.listOrderBy(query),
      include: accommodationInclude,
    };
    const toOutput = (item: AccommodationRecord) =>
      viewer && !this.canAccess(item, actor)
        ? this.serializeForViewer(item)
        : this.serialize(item);

    if (!wantsPagination(query)) {
      const items = await this.prisma.accommodation.findMany(findMany);
      return items.map(toOutput);
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({ ...findMany, skip, take }),
      this.prisma.accommodation.count({ where }),
    ]);
    return paginatedResult(items.map(toOutput), total, page, pageSize);
  }

  async report(actor: Actor, year?: number) {
    const selectedYear = year ?? currentJalaliYear();
    const scope = this.listWhere({}, actor);
    const withManagerWhere = this.andWhere(scope, {
      managers: { some: this.assignedManagerWhere() },
    });
    const withoutManagerWhere = this.andWhere(scope, {
      managers: { none: this.assignedManagerWhere() },
    });
    const activeStatusWhere = this.andWhere(scope, {
      status: AccommodationStatus.ACTIVE,
    });
    const inactiveStatusWhere = this.andWhere(scope, {
      status: { not: AccommodationStatus.ACTIVE },
    });
    const occupancyWhere = this.andWhere(scope, {
      allocations: {
        some: {
          status: AllocationStatus.ACTIVE,
          reservation: { year: selectedYear },
        },
      },
    });
    const [
      total,
      typeRows,
      types,
      genderRows,
      managementRows,
      comboRows,
      withManager,
      withoutManager,
      activeStatus,
      inactiveStatus,
      occupied,
    ] = await Promise.all([
      this.prisma.accommodation.count({ where: scope }),
      this.prisma.accommodation.groupBy({
        by: ['typeId'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.accommodationType.findMany({
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          nameFa: true,
          nameEn: true,
          icon: true,
          isActive: true,
          sortOrder: true,
        },
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
      this.prisma.accommodation.count({ where: activeStatusWhere }),
      this.prisma.accommodation.count({ where: inactiveStatusWhere }),
      this.prisma.accommodation.count({ where: occupancyWhere }),
    ]);

    const typeCount = new Map(typeRows.map((row) => [row.typeId, row._count._all]));
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
        active: activeStatus,
        inactive: inactiveStatus,
      },
      occupancy: {
        year: selectedYear,
        occupied,
      },
      byType: types.map((type) => ({
        type,
        count: typeCount.get(type.id) ?? 0,
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
      where: { id, status: { notIn: ACCOMMODATION_UNAVAILABLE_STATUSES } },
      select: {
        id: true,
        name: true,
        typeId: true,
        type: {
          select: {
            id: true,
            code: true,
            nameFa: true,
            nameEn: true,
            icon: true,
          },
        },
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
        classroomCount: true,
        schoolDistrict: { select: { id: true, name: true } },
        ownerName: true,
        ownerPhone: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { imageId: true },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('اسکان یافت نشد');
    }
    const num = (value: Prisma.Decimal | null) =>
      value == null ? null : Number(value);
    const { images, ...rest } = item;
    const school = isSchoolAccommodationType(item.type);
    return {
      ...rest,
      imageIds: images.map((image) => image.imageId),
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      distanceToShrineKm: num(item.distanceToShrineKm),
      distanceToMashhadKm: num(item.distanceToMashhadKm),
      classroomCount: school ? rest.classroomCount : null,
      schoolDistrict: school ? rest.schoolDistrict : null,
    };
  }

  async findOne(id: string, actor: Actor) {
    const item = await this.prisma.accommodation.findUnique({
      where: { id },
      include: accommodationInclude,
    });
    if (!item) {
      throw new NotFoundException('اسکان یافت نشد');
    }
    if (this.canAccess(item, actor) || item.introducedById === actor.id) {
      return this.serialize(item);
    }
    if (this.isDirectoryViewer(actor) && !isAccommodationUnavailable(item.status)) {
      return this.serializeForViewer(item);
    }
    throw new NotFoundException('اسکان یافت نشد');
  }

  async create(
    dto: CreateAccommodationDto,
    actor: Actor,
    options?: { introducedById?: string },
  ) {
    this.assertCapacity({
      maleCapacity: dto.maleCapacity,
      femaleCapacity: dto.femaleCapacity,
      overflowPercent: dto.overflowPercent,
      assignedMaleCapacity: 0,
      assignedFemaleCapacity: 0,
    });
    const geo = await this.resolveGeo(dto);
    const type = await this.resolveType(dto.typeId);
    await this.applySchoolFields(dto, type);
    await this.applyTypeSpecificFields(dto, type);
    const admin = isAdmin(actor);
    const introducing = Boolean(options?.introducedById);
    if (!admin && !introducing) {
      await this.users.grantAutoRole(actor.id, 'ACCOMMODATION_MANAGER');
    }
    const managerIds = admin
      ? [...new Set(dto.managerUserIds ?? [])]
      : introducing
        ? []
        : [actor.id];
    const wantsPrimary = admin
      ? Boolean(dto.primaryManagerUserId)
      : !introducing && dto.isPrimary !== false;
    await this.assertImages(dto.imageIds);
    if (admin) {
      await this.assertReviewer(dto.reviewerId);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.accommodation.create({
        data: {
          ...(this.toData(dto, geo, false, admin) as Prisma.AccommodationUncheckedCreateInput),
          ...(options?.introducedById
            ? {
                introducedById: options.introducedById,
                operationStatus: AccommodationOperationStatus.INACTIVE,
              }
            : {}),
        },
      });
      await this.syncManagers(tx, {
        accommodationId: row.id,
        managerUserIds: managerIds,
        primaryUserId: admin
          ? (dto.primaryManagerUserId ?? null)
          : wantsPrimary
            ? actor.id
            : null,
        forcePrimaryIfFirst: !admin && !introducing,
      });
      await this.syncImages(tx, row.id, dto.imageIds ?? []);
      if (admin) {
        await this.recordEvaluation(tx, row.id, dto, {
          inspectionStatus: 'NOT_DONE',
          inspectionResult: null,
          reviewerId: null,
          lastEvaluatedAt: null,
        });
      }
      return row;
    });

    if (dto.contacts) {
      await this.syncContacts(created.id, dto.contacts);
    }

    return this.findOne(created.id, actor);
  }

  async introduce(dto: CreateAccommodationDto, actor: Actor) {
    if (isAdmin(actor)) {
      throw new ForbiddenException('معرفی اسکان برای مدیر سامانه نیست');
    }
    const created = await this.create(
      {
        ...this.withoutAdminReviewFields(dto),
        status: AccommodationStatus.PENDING_REVIEW,
      },
      actor,
      { introducedById: actor.id },
    );
    await this.notifyIntroduction(created, actor.id);
    return created;
  }

  async introducePublic(dto: PublicIntroduceAccommodationDto) {
    const {
      introducerFirstName,
      introducerLastName,
      introducerPhone,
      ...accommodation
    } = dto;
    const account = await this.users.ensurePublicIntroducer({
      firstName: introducerFirstName,
      lastName: introducerLastName,
      phone: introducerPhone,
    });
    const actor = { id: account.id, userRoles: account.userRoles };
    const created = await this.create(
      {
        ...this.withoutAdminReviewFields(accommodation),
        status: AccommodationStatus.PENDING_REVIEW,
      },
      actor,
      { introducedById: account.id },
    );
    await this.notifyPublicIntroduction(
      created,
      account.id,
      account.phone,
      account.fullName,
      account.loginWithPhone,
    );
    return { ...created, loginWithPhone: account.loginWithPhone };
  }

  private introducerGreeting(fullName?: string | null) {
    const name = fullName?.trim();
    return name ? `${name} گرامی` : 'کاربر گرامی';
  }

  private introductionRegisteredBody(
    greeting: string,
    accommodationName: string,
    extraLines: string[] = [],
  ) {
    return [
      'با سلام و احترام',
      greeting,
      '',
      `معرفی محل اسکان «${accommodationName}» با موفقیت در سامانه ثبت شد.`,
      'کارشناسان واحد اسکان ستاد جمعیت درخواست شما را بررسی می‌کنند و نتیجه را از همین طریق به اطلاع جنابعالی می‌رسانند.',
      ...extraLines,
      '',
      'از همراهی شما در خدمت به زائران حضرت امام رضا علیه‌السلام سپاسگزاریم.',
    ].join('\n');
  }

  private async notifyIntroduction(
    accommodation: { name: string },
    actorId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { phone: true, fullName: true },
    });
    await this.sendIntroducerSms({
      phone: user?.phone,
      body: this.introductionRegisteredBody(
        this.introducerGreeting(user?.fullName),
        accommodation.name,
      ),
      sentById: actorId,
      accommodationName: accommodation.name,
      logLabel: 'معرفی',
    });
  }

  private async notifyPublicIntroduction(
    accommodation: { name: string },
    actorId: string,
    phone: string,
    fullName: string | null | undefined,
    loginWithPhone: boolean,
  ) {
    const extra = loginWithPhone
      ? [
          'ضمناً می‌توانید با شماره همراه خود به‌عنوان نام کاربری و رمز عبور وارد سامانه شوید و نتیجه درخواست را مشاهده کنید.',
        ]
      : ['برای مشاهده نتیجه درخواست، با حساب کاربری خود وارد سامانه شوید.'];
    await this.sendIntroducerSms({
      phone,
      body: this.introductionRegisteredBody(
        this.introducerGreeting(fullName),
        accommodation.name,
        extra,
      ),
      sentById: actorId,
      accommodationName: accommodation.name,
      logLabel: 'معرفی',
    });
  }

  private async notifyIntroductionDecisionIfNeeded(
    current: AccommodationRecord,
    dto: UpdateAccommodationDto,
    admin: boolean,
    actorId: string,
  ) {
    if (!current.introducedById) return;

    const nextResult =
      admin && dto.inspectionResult !== undefined
        ? dto.inspectionResult
        : current.inspectionResult;
    const nextStatus =
      dto.status !== undefined
        ? (dto.status as AccommodationStatus)
        : current.status;

    let outcome: 'approved' | 'rejected' | 'conditional' | null = null;
    if (nextResult !== current.inspectionResult) {
      if (nextResult === AccommodationInspectionResult.APPROVED) {
        outcome = 'approved';
      } else if (nextResult === AccommodationInspectionResult.REJECTED) {
        outcome = 'rejected';
      } else if (nextResult === AccommodationInspectionResult.CONDITIONAL) {
        outcome = 'conditional';
      }
    } else if (
      isAccommodationUnavailable(current.status) &&
      nextStatus === AccommodationStatus.ACTIVE
    ) {
      outcome = 'approved';
    }

    if (!outcome) return;
    await this.notifyIntroductionReview(
      current.name,
      current.introducedById,
      outcome,
      actorId,
    );
  }

  private introductionReviewBody(
    greeting: string,
    accommodationName: string,
    outcome: 'approved' | 'rejected' | 'conditional',
  ) {
    if (outcome === 'approved') {
      return [
        'با سلام و احترام',
        greeting,
        '',
        `محل اسکان «${accommodationName}» که جنابعالی معرفی فرمودید، پس از بررسی واحد اسکان ستاد جمعیت مورد تأیید قرار گرفت.`,
        '',
        'از حسن نیت و خدمت شما به زائران حضرت امام رضا علیه‌السلام صمیمانه قدردانی می‌کنیم.',
      ].join('\n');
    }
    if (outcome === 'conditional') {
      return [
        'با سلام و احترام',
        greeting,
        '',
        `محل اسکان «${accommodationName}» که جنابعالی معرفی فرمودید، به‌صورت مشروط تأیید شد.`,
        'لطفاً با ورود به سامانه، موارد نیازمند اصلاح را تکمیل فرمایید تا بررسی نهایی انجام شود.',
        '',
        'از همراهی شما سپاسگزاریم.',
      ].join('\n');
    }
    return [
      'با سلام و احترام',
      greeting,
      '',
      `متأسفانه محل اسکان «${accommodationName}» که جنابعالی معرفی فرمودید، در بررسی واحد اسکان ستاد جمعیت مورد تأیید قرار نگرفت.`,
      '',
      'از همراهی شما سپاسگزاریم. در صورت تمایل می‌توانید پس از اصلاح اطلاعات، مجدداً نسبت به معرفی اقدام فرمایید.',
    ].join('\n');
  }

  private async notifyIntroductionReview(
    accommodationName: string,
    introducedById: string,
    outcome: 'approved' | 'rejected' | 'conditional',
    actorId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: introducedById },
      select: { phone: true, fullName: true },
    });
    const logLabel =
      outcome === 'approved'
        ? 'تأیید'
        : outcome === 'rejected'
          ? 'عدم تأیید'
          : 'تأیید مشروط';
    await this.sendIntroducerSms({
      phone: user?.phone,
      body: this.introductionReviewBody(
        this.introducerGreeting(user?.fullName),
        accommodationName,
        outcome,
      ),
      sentById: actorId,
      accommodationName,
      logLabel,
    });
  }

  private async sendIntroducerSms(input: {
    phone?: string | null;
    body: string;
    sentById: string;
    accommodationName: string;
    logLabel: string;
  }) {
    const phone = input.phone?.trim();
    if (!phone) {
      this.logger.warn(
        `پیامک ${input.logLabel} اسکان «${input.accommodationName}» ارسال نشد: کاربر شماره همراه ندارد`,
      );
      return;
    }
    try {
      await this.sms.send({
        phone,
        body: input.body,
        sentById: input.sentById,
      });
    } catch (error) {
      this.logger.warn(
        `پیامک ${input.logLabel} اسکان «${input.accommodationName}» ارسال نشد: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async update(id: string, dto: UpdateAccommodationDto, actor: Actor) {
    this.assertCanEdit(actor);
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
    const type = dto.typeId
      ? await this.resolveType(dto.typeId, { allowInactive: true })
      : current.type;
    await this.applySchoolFields(dto, type);
    await this.applyTypeSpecificFields(dto, type);
    const admin = isAdmin(actor);
    if (dto.imageIds) {
      await this.assertImages(dto.imageIds);
    }
    if (admin) {
      await this.assertReviewer(dto.reviewerId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accommodation.update({
        where: { id },
        data: this.toData(dto, geo, true, admin) as Prisma.AccommodationUncheckedUpdateInput,
      });
      if (dto.imageIds) {
        await this.syncImages(tx, id, dto.imageIds);
      }
      if (admin) {
        await this.recordEvaluation(tx, id, dto, current);
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
          forcePrimaryIfFirst: false,
        });
      } else if (!admin && dto.isPrimary === true) {
        await this.setUserPrimary(tx, actor.id, id);
      }
    });

    if (dto.contacts !== undefined) {
      await this.syncContacts(id, dto.contacts ?? []);
    }

    await this.notifyIntroductionDecisionIfNeeded(current, dto, admin, actor.id);

    return this.findOne(id, actor);
  }

  async remove(id: string, actor: Actor) {
    this.assertCanEdit(actor);
    const current = await this.findRecord(id, actor);
    const distributionCount = await this.prisma.restaurantMealPlanDistribution.count({
      where: { accommodationId: id },
    });
    if (distributionCount) {
      throw new BadRequestException(
        'ابتدا توزیع غذای وابسته به این اسکان را حذف کنید',
      );
    }
    const imageIds = current.images.map((image) => image.imageId);
    await this.prisma.accommodation.delete({ where: { id } });
    if (imageIds.length) {
      await this.prisma.storedImage.deleteMany({
        where: { id: { in: imageIds } },
      });
    }
    return { ok: true };
  }

  async assignManager(id: string, userId: string, actor: Actor) {
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
      where: { userId_accommodationId: { userId, accommodationId: id } },
    });
    if (existing) {
      throw new ConflictException('این مدیر قبلاً به این اسکان تخصیص داده شده است');
    }

    await this.prisma.$transaction(async (tx) => {
      const hasPrimary = await tx.accommodationManager.findFirst({
        where: { userId, isPrimary: true },
        select: { id: true },
      });
      await tx.accommodationManager.create({
        data: {
          userId,
          accommodationId: id,
          isPrimary: !hasPrimary,
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

  async findYearCaravanPlacements(id: string, actor: Actor, year?: number) {
    await this.findRecord(id, actor);
    const selectedYear = year ?? currentJalaliYear();
    const rows = await this.prisma.reservation.findMany({
      where: {
        year: selectedYear,
        type: ReservationType.CARAVAN,
        caravanId: { not: null },
        allocations: {
          some: { accommodationId: id, status: AllocationStatus.ACTIVE },
        },
      },
      select: {
        caravan: {
          select: {
            id: true,
            name: true,
            manager: { select: { id: true, fullName: true } },
            city: {
              select: { id: true, nameFa: true, nameEn: true, provinceId: true },
            },
          },
        },
        caravanManager: { select: { id: true, fullName: true } },
        allocations: {
          where: { accommodationId: id, status: AllocationStatus.ACTIVE },
          select: { gender: true, headcount: true },
        },
      },
    });

    const byCaravan = new Map<
      string,
      {
        id: string;
        name: string;
        city: {
          id: string;
          nameFa: string;
          nameEn: string | null;
          provinceId: string;
        } | null;
        manager: { id: string; fullName: string } | null;
        placedMaleCount: number;
        placedFemaleCount: number;
      }
    >();
    for (const row of rows) {
      if (!row.caravan) continue;
      const placedMaleCount = row.allocations
        .filter((item) => item.gender === UserGender.MALE)
        .reduce((sum, item) => sum + item.headcount, 0);
      const placedFemaleCount = row.allocations
        .filter((item) => item.gender === UserGender.FEMALE)
        .reduce((sum, item) => sum + item.headcount, 0);
      const current = byCaravan.get(row.caravan.id);
      if (!current) {
        byCaravan.set(row.caravan.id, {
          id: row.caravan.id,
          name: row.caravan.name,
          city: row.caravan.city,
          manager: row.caravanManager ?? row.caravan.manager,
          placedMaleCount,
          placedFemaleCount,
        });
        continue;
      }
      current.placedMaleCount += placedMaleCount;
      current.placedFemaleCount += placedFemaleCount;
      if (!current.manager) {
        current.manager = row.caravanManager ?? row.caravan.manager;
      }
    }

    return {
      year: selectedYear,
      items: [...byCaravan.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'fa'),
      ),
    };
  }

  async findYearReservations(id: string, actor: Actor, year?: number) {
    await this.findRecord(id, actor);
    const selectedYear = year ?? currentJalaliYear();
    const rows = await this.prisma.reservation.findMany({
      where: {
        year: selectedYear,
        allocations: {
          some: { accommodationId: id, status: AllocationStatus.ACTIVE },
        },
      },
      select: {
        id: true,
        code: true,
        type: true,
        maleCount: true,
        femaleCount: true,
        caravanManager: {
          select: { id: true, firstName: true, lastName: true, fullName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, fullName: true },
        },
        originCity: {
          select: { id: true, nameFa: true, nameEn: true, provinceId: true },
        },
        walkingRoute: { select: { id: true, name: true } },
        allocations: {
          where: { accommodationId: id, status: AllocationStatus.ACTIVE },
          select: { gender: true, headcount: true },
        },
      },
      orderBy: { code: 'asc' },
    });
    return {
      year: selectedYear,
      items: rows.map(({ allocations, ...item }) => ({
        ...item,
        placedMaleCount: allocations
          .filter((row) => row.gender === UserGender.MALE)
          .reduce((sum, row) => sum + row.headcount, 0),
        placedFemaleCount: allocations
          .filter((row) => row.gender === UserGender.FEMALE)
          .reduce((sum, row) => sum + row.headcount, 0),
      })),
    };
  }

  async assignmentStats(actor: Actor) {
    this.assertAdmin(actor);
    const [total, withManager, withoutManager] = await Promise.all([
      this.prisma.accommodation.count(),
      this.prisma.accommodation.count({ where: this.withManagerWhere() }),
      this.prisma.accommodation.count({ where: this.withoutManagerWhere() }),
    ]);
    return { total, withManager, withoutManager };
  }

  async findAssignments(query: FindAccommodationAssignmentsQueryDto, actor: Actor) {
    this.assertAdmin(actor);
    const where = this.assignmentWhere(query);
    const findMany = {
      where,
      orderBy: this.assignmentOrderBy(query),
      select: {
        id: true,
        name: true,
        type: true,
        city: { select: geoSelect },
        province: { select: geoSelect },
        maleCapacity: true,
        femaleCapacity: true,
        managers: {
          orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
          select: {
            id: true,
            userId: true,
            isPrimary: true,
            user: { select: { fullName: true } },
          },
        },
      },
    };

    const mapRow = (item: {
      id: string;
      name: string;
      type: {
        id: string;
        code: string;
        nameFa: string;
        nameEn: string;
        icon: string;
        isActive: boolean;
        sortOrder: number;
      };
      city: { id: string; nameFa: string; nameEn: string | null } | null;
      province: { id: string; nameFa: string; nameEn: string | null } | null;
      maleCapacity: number;
      femaleCapacity: number;
      managers: {
        id: string;
        userId: string;
        isPrimary: boolean;
        user: { fullName: string } | null;
      }[];
    }) => {
      const assigned =
        item.managers.find((row) => row.isPrimary) ?? item.managers[0];
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        city: item.city,
        province: item.province,
        managerUserId: assigned?.userId ?? null,
        managerAssignmentId: assigned?.id ?? null,
        managerName: assigned?.user?.fullName ?? null,
        maleCapacity: item.maleCapacity,
        femaleCapacity: item.femaleCapacity,
      };
    };

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodation.findMany({ ...findMany, skip, take }),
      this.prisma.accommodation.count({ where }),
    ]);
    return paginatedResult(items.map(mapRow), total, page, pageSize);
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
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
        type: (dir) => ({ type: { nameFa: dir } }),
        managementType: (dir) => ({ managementType: dir }),
        genderType: (dir) => ({ genderType: dir }),
        status: (dir) => ({ status: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: FindAccommodationsQueryDto,
    actor: Actor,
    options: { unscoped?: boolean } = {},
  ): Prisma.AccommodationWhereInput {
    const filters: Prisma.AccommodationWhereInput[] = [];
    if (!isAdmin(actor) && !options.unscoped) {
      filters.push({ managers: { some: { userId: actor.id } } });
    }
    if (query.typeId) {
      filters.push({ typeId: query.typeId });
    }
    if (query.managementType) {
      filters.push({ managementType: query.managementType });
    }
    if (query.genderType) {
      filters.push({ genderType: query.genderType });
    }
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.introduced === true) {
      filters.push({ introducedById: { not: null } });
    }
    if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    }
    if (query.schoolDistrictId) {
      filters.push({
        schoolDistrictId: query.schoolDistrictId,
        ...(query.typeId ? {} : { type: { code: 'school' } }),
      });
    }
    if (query.managerUserId) {
      filters.push({
        managers: { some: { userId: query.managerUserId } },
      });
    }
    if (query.year) {
      filters.push({
        allocations: {
          some: {
            status: AllocationStatus.ACTIVE,
            reservation: { year: query.year },
          },
        },
      });
    }
    if (query.hasManager !== undefined) {
      filters.push(
        query.hasManager
          ? { managers: { some: this.assignedManagerWhere() } }
          : { managers: { none: this.assignedManagerWhere() } },
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
          { ownerName: containsInsensitive(query.q) },
          { ownerPhone: containsInsensitive(query.q) },
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

  private assignedManagerWhere(): Prisma.AccommodationManagerWhereInput {
    return {};
  }

  private withManagerWhere(): Prisma.AccommodationWhereInput {
    return { managers: { some: this.assignedManagerWhere() } };
  }

  private withoutManagerWhere(): Prisma.AccommodationWhereInput {
    return { managers: { none: this.assignedManagerWhere() } };
  }

  private managerStatusWhere(
    status: AssignmentManagerFilter | undefined,
  ): Prisma.AccommodationWhereInput {
    if (status === 'with') return this.withManagerWhere();
    if (status === 'without') return this.withoutManagerWhere();
    return {};
  }

  private assignmentWhere(
    query: FindAccommodationAssignmentsQueryDto,
  ): Prisma.AccommodationWhereInput {
    const filters: Prisma.AccommodationWhereInput[] = [
      this.managerStatusWhere(query.managerStatus),
    ];
    if (query.q) {
      const q = containsInsensitive(query.q);
      filters.push({
        OR: [
          { name: q },
          { city: { nameFa: q } },
          { city: { nameEn: q } },
          { province: { nameFa: q } },
          { province: { nameEn: q } },
          {
            managers: {
              some: { user: { fullName: q } },
            },
          },
          {
            managers: {
              some: { user: { username: q } },
            },
          },
        ],
      });
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private assignmentOrderBy(
    query: FindAccommodationAssignmentsQueryDto,
  ): Prisma.AccommodationOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.AccommodationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        type: (dir) => ({ type: { nameFa: dir } }),
        city: (dir) => ({ city: { nameFa: dir } }),
      },
      [{ name: 'asc' }, { id: 'asc' }],
    );
  }

  private assertCanEdit(actor: Actor) {
    if (isAdmin(actor) || isAccommodationManager(actor)) return;
    throw new ForbiddenException('ویرایش اسکان فقط برای مدیریت و مدیر اسکان مجاز است');
  }

  private canAccess(item: { managers: { userId: string }[] }, actor: Actor) {
    return isAdmin(actor) || item.managers.some((row) => row.userId === actor.id);
  }

  /** Read-only directory access (pilgrim, caravan/group manager, …): active accommodations only. */
  private isDirectoryViewer(actor: Actor) {
    return !isAdmin(actor) && !isAccommodationManager(actor);
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

  private async resolveType(
    typeId: string,
    options: { allowInactive?: boolean } = {},
  ) {
    const item = await this.prisma.accommodationType.findUnique({
      where: { id: typeId },
    });
    if (!item) {
      throw new BadRequestException('نوع اسکان انتخاب‌شده معتبر نیست');
    }
    if (!item.isActive && !options.allowInactive) {
      throw new BadRequestException('نوع اسکان انتخاب‌شده غیرفعال است');
    }
    return item;
  }

  private async applySchoolFields(
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    type: { code: string },
  ) {
    if (!isSchoolAccommodationType(type)) {
      dto.classroomCount = null;
      dto.schoolDistrictId = null;
      return;
    }
    if (!dto.schoolDistrictId) return;
    const district = await this.prisma.schoolDistrict.findUnique({
      where: { id: dto.schoolDistrictId },
      select: { id: true },
    });
    if (!district) {
      throw new BadRequestException('ناحیه انتخاب‌شده معتبر نیست');
    }
  }

  private async applyTypeSpecificFields(
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    type: { code: string },
  ) {
    const kind = accommodationTypeDetailKind(type);
    const record = dto as Record<string, unknown>;
    for (const key of typeDetailKeysToClear(kind)) {
      record[key] = null;
    }
    const keep = new Set(
      kind ? (typeDetailKeysByKind[kind] as readonly string[]) : [],
    );
    const imageMessages: Record<(typeof typeDetailImageKeys)[number], string> =
      {
        medicalWrittenApprovalImageId: 'فایل تأیید کتبی مرجع مسئول معتبر نیست',
        schoolEquipmentHandoverImageId: 'صورت‌جلسه تحویل تجهیزات معتبر نیست',
        schoolFinalHandoverImageId: 'صورت‌جلسه تخلیه و تحویل نهایی معتبر نیست',
      };
    for (const key of typeDetailImageKeys) {
      if (!keep.has(key)) continue;
      await this.assertStoredImage(record[key] as string | null | undefined, imageMessages[key]);
    }
    if (kind === 'school' && dto.schoolManagerUserId) {
      await this.assertUser(dto.schoolManagerUserId, 'مدیر مدرسه یا سرایدار معتبر نیست');
    }
  }

  private async assertStoredImage(imageId?: string | null, message?: string) {
    if (!imageId) return;
    const image = await this.prisma.storedImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException(message ?? 'فایل انتخاب‌شده معتبر نیست');
    }
  }

  private toData(
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    geo: { countryId: string | null; provinceId: string | null; cityId: string | null },
    isUpdate = false,
    admin = false,
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
    set('typeId', dto.typeId);
    set('status', dto.status as AccommodationStatus | undefined);
    set('genderType', dto.genderType as GenderType | undefined);
    set('managementType', dto.managementType as ManagementType | undefined);
    set('maleCapacity', dto.maleCapacity);
    set('femaleCapacity', dto.femaleCapacity);
    set('overflowPercent', dto.overflowPercent);
    set('ownerName', dto.ownerName);
    set('ownerPhone', dto.ownerPhone);
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
    set('classroomCount', dto.classroomCount);
    set('schoolDistrictId', dto.schoolDistrictId);
    const details = dto as Record<string, unknown>;
    for (const key of accommodationTypeDetailKeys) {
      set(key, details[key]);
    }
    if (admin) {
      set('inspectionStatus', dto.inspectionStatus as AccommodationInspectionStatus | undefined);
      set('inspectionResult', dto.inspectionResult as AccommodationInspectionResult | null | undefined);
      set('reviewerId', dto.reviewerId);
      set('lastEvaluatedAt', parseOptionalIsoDate(dto.lastEvaluatedAt));
      set('operationStatus', dto.operationStatus as AccommodationOperationStatus | undefined);
    }

    if (!isUpdate) {
      return {
        ...data,
        name: (dto as CreateAccommodationDto).name.trim(),
        typeId: (dto as CreateAccommodationDto).typeId,
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
        firstName: contact.firstName ?? '',
        lastName: contact.lastName ?? '',
        nationalId: contact.nationalId ?? '',
        phone: contact.phone ?? '',
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

  private async syncManagers(
    tx: Prisma.TransactionClient,
    input: {
      accommodationId: string;
      managerUserIds: string[];
      primaryUserId: string | null;
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
          userId_accommodationId: {
            userId,
            accommodationId: input.accommodationId,
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
      where: {
        userId_accommodationId: { userId, accommodationId },
      },
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
    const { images, evaluations, lastEvaluatedAt, ...rest } = item;
    return {
      ...rest,
      imageIds: images.map((image) => image.imageId),
      lastEvaluatedAt: toIsoDateOnly(lastEvaluatedAt),
      evaluations: evaluations.map((row) => ({
        id: row.id,
        inspectionStatus: row.inspectionStatus,
        inspectionResult: row.inspectionResult,
        reviewerId: row.reviewerId,
        reviewer: row.reviewer,
        evaluatedAt: toIsoDateOnly(row.evaluatedAt),
        createdAt: row.createdAt,
      })),
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      distanceToShrineKm: num(item.distanceToShrineKm),
      distanceToMashhadKm: num(item.distanceToMashhadKm),
    };
  }

  private serializeForViewer(item: AccommodationRecord) {
    const hidePrivate = <T extends { user: { nationalId: string | null; birthDate: Date | null } }>(
      row: T,
    ) => ({ ...row, user: { ...row.user, nationalId: null, birthDate: null } });
    const {
      inspectionStatus: _inspectionStatus,
      inspectionResult: _inspectionResult,
      reviewerId: _reviewerId,
      reviewer: _reviewer,
      lastEvaluatedAt: _lastEvaluatedAt,
      evaluations: _evaluations,
      operationStatus: _operationStatus,
      ...base
    } = this.serialize(item);
    return {
      ...base,
      contacts: base.contacts.map(hidePrivate),
    };
  }

  private withoutAdminReviewFields(dto: CreateAccommodationDto): CreateAccommodationDto {
    const {
      inspectionStatus: _inspectionStatus,
      inspectionResult: _inspectionResult,
      reviewerId: _reviewerId,
      lastEvaluatedAt: _lastEvaluatedAt,
      operationStatus: _operationStatus,
      ...rest
    } = dto;
    return rest;
  }

  private async assertImages(imageIds?: string[]) {
    if (!imageIds?.length) return;
    if (imageIds.length > MAX_ACCOMMODATION_IMAGES) {
      throw new BadRequestException('تعداد تصاویر اسکان بیش از حد مجاز است');
    }
    const unique = [...new Set(imageIds)];
    const count = await this.prisma.storedImage.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new BadRequestException('یکی از تصاویر انتخاب‌شده معتبر نیست');
    }
  }

  private async assertReviewer(reviewerId?: string | null) {
    await this.assertUser(reviewerId, 'مسئول بررسی انتخاب‌شده معتبر نیست');
  }

  private async assertUser(userId?: string | null, message?: string) {
    if (!userId) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(message ?? 'کاربر انتخاب‌شده معتبر نیست');
    }
  }

  private async syncImages(
    tx: Prisma.TransactionClient,
    accommodationId: string,
    imageIds: string[],
  ) {
    const current = await tx.accommodationImage.findMany({
      where: { accommodationId },
      select: { imageId: true },
    });
    const nextIds = [...new Set(imageIds)].slice(0, MAX_ACCOMMODATION_IMAGES);
    const removed = current
      .map((row) => row.imageId)
      .filter((imageId) => !nextIds.includes(imageId));
    await tx.accommodationImage.deleteMany({ where: { accommodationId } });
    if (nextIds.length) {
      await tx.accommodationImage.createMany({
        data: nextIds.map((imageId, sortOrder) => ({
          accommodationId,
          imageId,
          sortOrder,
        })),
      });
    }
    if (removed.length) {
      await tx.storedImage.deleteMany({ where: { id: { in: removed } } });
    }
  }

  private async recordEvaluation(
    tx: Prisma.TransactionClient,
    accommodationId: string,
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    current: {
      inspectionStatus: AccommodationInspectionStatus;
      inspectionResult: AccommodationInspectionResult | null;
      reviewerId: string | null;
      lastEvaluatedAt: Date | null;
    },
  ) {
    const nextStatus = dto.inspectionStatus ?? current.inspectionStatus;
    const nextResult =
      dto.inspectionResult === undefined ? current.inspectionResult : dto.inspectionResult;
    const nextReviewerId =
      dto.reviewerId === undefined ? current.reviewerId : dto.reviewerId;
    const nextDate =
      dto.lastEvaluatedAt === undefined
        ? current.lastEvaluatedAt
        : parseOptionalIsoDate(dto.lastEvaluatedAt) ?? null;
    const changed =
      dto.inspectionStatus !== undefined ||
      dto.inspectionResult !== undefined ||
      dto.reviewerId !== undefined ||
      dto.lastEvaluatedAt !== undefined;
    if (!changed) return;
    const same =
      nextStatus === current.inspectionStatus &&
      nextResult === current.inspectionResult &&
      nextReviewerId === current.reviewerId &&
      toIsoDateOnly(nextDate) === toIsoDateOnly(current.lastEvaluatedAt);
    if (same) return;
    const evaluatedAt = nextDate ?? parseIsoDate(todayIsoDateTehran());
    await tx.accommodationEvaluation.create({
      data: {
        accommodationId,
        inspectionStatus: nextStatus,
        inspectionResult: nextResult,
        reviewerId: nextReviewerId,
        evaluatedAt,
      },
    });
    if (!nextDate) {
      await tx.accommodation.update({
        where: { id: accommodationId },
        data: { lastEvaluatedAt: evaluatedAt },
      });
    }
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
        { header: 'وضعیت بهره‌برداری', key: 'operationStatus', width: 18 },
        { header: 'نام نماینده/مالک', key: 'ownerName', width: 22 },
        { header: 'شماره نماینده/مالک', key: 'ownerPhone', width: 18 },
        { header: 'وضعیت بازدید کارشناسی', key: 'inspectionStatus', width: 22 },
        { header: 'نتیجه بازدید', key: 'inspectionResult', width: 16 },
        { header: 'مسئول بررسی', key: 'reviewer', width: 22 },
        { header: 'تاریخ آخرین ارزیابی', key: 'lastEvaluatedAt', width: 18 },
        { header: 'کشور', key: 'country', width: 14 },
        { header: 'استان', key: 'province', width: 16 },
        { header: 'شهر', key: 'city', width: 16 },
        { header: 'تلفن محل', key: 'phone', width: 16 },
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
        { header: 'تعداد کلاس', key: 'classroomCount', width: 14 },
        { header: 'ناحیه', key: 'schoolDistrict', width: 20 },
        { header: 'مدیران', key: 'managers', width: 28 },
        { header: 'توضیحات', key: 'description', width: 32 },
      ],
      rows: items.map((item) => ({
        name: item.name,
        type: localizedGeoName(item.type),
        managementType: managementTypeLabels[item.managementType],
        genderType: genderTypeLabels[item.genderType],
        status: accommodationStatusLabels[item.status],
        operationStatus: accommodationOperationStatusLabels[item.operationStatus],
        ownerName: item.ownerName ?? '',
        ownerPhone: item.ownerPhone ?? '',
        inspectionStatus: accommodationInspectionStatusLabels[item.inspectionStatus],
        inspectionResult: item.inspectionResult
          ? accommodationInspectionResultLabels[item.inspectionResult]
          : '',
        reviewer: item.reviewer?.fullName ?? '',
        lastEvaluatedAt: item.lastEvaluatedAt ?? '',
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
        classroomCount: isSchoolAccommodationType(item.type)
          ? item.classroomCount
          : '',
        schoolDistrict: isSchoolAccommodationType(item.type)
          ? (item.schoolDistrict?.name ?? '')
          : '',
        managers: item.managers
          .map((manager) => {
            const primary = manager.isPrimary ? ' (اصلی)' : '';
            const name = manager.user?.fullName ?? 'بدون مدیر';
            return `${name}${primary}`;
          })
          .join('، '),
        description: item.description ?? '',
      })),
    });
  }
}

const accommodationStatusLabels: Record<AccommodationStatus, string> = {
  ACTIVE: 'فعال',
  PENDING_REVIEW: 'در انتظار تأیید',
  FULL: 'تکمیل ظرفیت',
  INACTIVE: 'غیرفعال',
};

const accommodationInspectionStatusLabels: Record<
  AccommodationInspectionStatus,
  string
> = {
  NOT_DONE: 'انجام نشده',
  PENDING: 'در انتظار',
  DONE: 'انجام شده',
};

const accommodationInspectionResultLabels: Record<
  AccommodationInspectionResult,
  string
> = {
  APPROVED: 'تأیید',
  CONDITIONAL: 'تأیید مشروط',
  REJECTED: 'عدم تأیید',
};

const accommodationOperationStatusLabels: Record<
  AccommodationOperationStatus,
  string
> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  EMERGENCY: 'اضطراری',
  OUT_OF_CYCLE: 'خارج از چرخه',
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

