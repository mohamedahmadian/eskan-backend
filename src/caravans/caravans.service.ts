import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isAdmin, isCaravanManager, isPilgrim, type RoleBearer } from '../auth/roles.util';
import { currentJalaliYear } from '../common/jalali-year';
import { localizedGeoName } from '../common/request-locale';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  AllocationStatus,
  CaravanStatus,
  Prisma,
  ReservationType,
  UserGender,
  UserStatus,
} from '../generated/prisma/client';
import { caravanStatusLabel, isCaravanActive } from './caravan-status';
import { PrismaService } from '../prisma/prisma.service';
import { joinFullName } from '../users/user-profile.util';
import { SmsService } from '../sms/sms.service';
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
import {
  CreateCaravanDto,
  MAX_CARAVAN_LICENSE_IMAGES,
} from './dto/create-caravan.dto';
import { FindCaravanHistoryQueryDto } from './dto/find-caravan-history-query.dto';
import {
  FindCaravansQueryDto,
  FindMineCaravansQueryDto,
} from './dto/find-caravans-query.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';

type Actor = RoleBearer & { id: string };

const caravanGenderKinds = ['FEMALE', 'MALE', 'MIXED', 'UNSPECIFIED'] as const;
type CaravanGenderKind = (typeof caravanGenderKinds)[number];

const caravanOrigins = ['IRANIAN', 'INTERNATIONAL'] as const;
type CaravanOrigin = (typeof caravanOrigins)[number];

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
  licenseImages: {
    orderBy: { sortOrder: 'asc' },
    select: { imageId: true },
  },
} satisfies Prisma.CaravanInclude;

type CaravanRecord = Prisma.CaravanGetPayload<{ include: typeof caravanInclude }>;

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
  private readonly logger = new Logger(CaravansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sms: SmsService,
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
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findMine(query: FindMineCaravansQueryDto, actor: RoleBearer & { id: string }) {
    const managerUserId = this.mineSubjectId(actor, query.userId);
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
    return paginatedResult(items.map((item) => this.serialize(item)), total, page, pageSize);
  }

  /** کاروان‌های خود کاربر؛ فقط مدیر می‌تواند برای شخص دیگری بپرسد. */
  private mineSubjectId(actor: RoleBearer & { id: string }, userId?: string) {
    if (!userId || userId === actor.id) return actor.id;
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به کاروان‌های این شخص مجاز نیست');
    }
    return userId;
  }

  private listOrderBy(
    query: FindCaravansQueryDto,
  ): Prisma.CaravanOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.CaravanOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        status: (dir) => ({ status: dir }),
        city: (dir) => ({ city: { nameFa: dir } }),
        manager: (dir) => ({ manager: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string, actor?: Actor) {
    const caravan = await this.prisma.caravan.findUnique({
      where: { id },
      include: caravanInclude,
    });
    if (!caravan) {
      throw new NotFoundException('کاروان یافت نشد');
    }
    if (
      actor &&
      !isAdmin(actor) &&
      !isCaravanManager(actor) &&
      !isPilgrim(actor) &&
      caravan.managerUserId !== actor.id
    ) {
      throw new ForbiddenException('امکان مشاهده این کاروان وجود ندارد');
    }
    return this.serialize(caravan);
  }

  async findYearPlacements(id: string, actor?: Actor) {
    await this.findOne(id, actor);
    const year = currentJalaliYear();
    const rows = await this.prisma.reservationAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        reservation: {
          year,
          type: ReservationType.CARAVAN,
          caravanId: id,
        },
      },
      select: {
        gender: true,
        headcount: true,
        accommodation: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            city: {
              select: { id: true, nameFa: true, nameEn: true, provinceId: true },
            },
          },
        },
      },
    });

    const byStay = new Map<
      string,
      {
        id: string;
        name: string;
        address: string | null;
        phone: string | null;
        city: {
          id: string;
          nameFa: string;
          nameEn: string;
          provinceId: string;
        } | null;
        placedMaleCount: number;
        placedFemaleCount: number;
      }
    >();
    for (const row of rows) {
      const stay = row.accommodation;
      let current = byStay.get(stay.id);
      if (!current) {
        current = {
          id: stay.id,
          name: stay.name,
          address: stay.address,
          phone: stay.phone,
          city: stay.city,
          placedMaleCount: 0,
          placedFemaleCount: 0,
        };
        byStay.set(stay.id, current);
      }
      if (row.gender === UserGender.MALE) current.placedMaleCount += row.headcount;
      if (row.gender === UserGender.FEMALE) current.placedFemaleCount += row.headcount;
    }

    return {
      year,
      items: [...byStay.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa')),
    };
  }

  async findPilgrimageHistory(
    id: string,
    query: FindCaravanHistoryQueryDto,
    actor?: Actor,
  ) {
    await this.findOne(id, actor);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where: Prisma.ReservationWhereInput = { caravanId: id };
    const orderBy = resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        code: (dir) => ({ code: dir }),
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
    const filters: Prisma.CaravanWhereInput[] = [];
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    }
    if (query.foundedYear != null) {
      filters.push({ foundedYear: query.foundedYear });
    }
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { officeAddress: containsInsensitive(query.q) },
          { officePhone: containsInsensitive(query.q) },
          { licenseNumber: containsInsensitive(query.q) },
          { city: { nameFa: containsInsensitive(query.q) } },
          { city: { nameEn: containsInsensitive(query.q) } },
          { manager: { fullName: containsInsensitive(query.q) } },
          { manager: { nationalId: containsInsensitive(query.q) } },
          { manager: { phone: containsInsensitive(query.q) } },
          { eitaa: containsInsensitive(query.q) },
          { bale: containsInsensitive(query.q) },
          { telegram: containsInsensitive(query.q) },
          { instagram: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) return undefined;
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
  }

  async create(dto: CreateCaravanDto, actor: RoleBearer & { id: string }) {
    const cityId = await this.resolveCityId(dto.cityId, actor.id);
    const licenseImageIds = this.resolveLicenseImageIds(dto) ?? [];
    await this.assertLicenseImages(licenseImageIds);

    const managerUserId = isAdmin(actor)
      ? dto.managerUserId
      : actor.id;
    const resolved = await this.resolveManager(managerUserId);
    await this.assertCaravanPerNationalId(resolved.managerUserId, actor);

    const caravan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.caravan.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          officeAddress: dto.officeAddress?.trim() || null,
          officePhone: dto.officePhone?.trim() || null,
          foundedYear: dto.foundedYear ?? null,
          cityId,
          licenseNumber: dto.licenseNumber?.trim() || null,
          managerUserId: resolved.managerUserId,
          eitaa: dto.eitaa?.trim() || null,
          bale: dto.bale?.trim() || null,
          telegram: dto.telegram?.trim() || null,
          instagram: dto.instagram?.trim() || null,
          status: dto.status ?? CaravanStatus.ACTIVE,
        },
      });
      await this.syncLicenseImages(tx, created.id, licenseImageIds);
      return tx.caravan.findUniqueOrThrow({
        where: { id: created.id },
        include: caravanInclude,
      });
    });

    return this.serialize(caravan);
  }

  async register(dto: CreateCaravanDto, actor: Actor) {
    if (dto.foundedYear == null) {
      throw new BadRequestException('سال تأسیس الزامی است');
    }
    if (!dto.cityId) {
      throw new BadRequestException('شهر مبدأ الزامی است');
    }
    if (isAdmin(actor) && !dto.managerUserId) {
      throw new BadRequestException('مدیر کاروان را انتخاب کنید');
    }

    const caravan = await this.create(
      { ...dto, status: CaravanStatus.PENDING_REVIEW },
      actor,
    );
    await this.notifyManagerWelcome(caravan, actor.id);
    return caravan;
  }

  private statusChangedClosing(status: CaravanStatus) {
    if (status === CaravanStatus.ACTIVE) {
      return 'کاروان شما تأیید و فعال شد. از این پس می‌توانید نسبت به ثبت پرونده زیارتی اقدام فرمایید.';
    }
    if (status === CaravanStatus.PENDING_REVIEW) {
      return 'کاروان شما در صف بررسی ستاد قرار گرفت. نتیجه بررسی از همین طریق به اطلاع جنابعالی خواهد رسید.';
    }
    return 'کاروان شما غیرفعال شد. تا فعال‌سازی مجدد، امکان ثبت پرونده زیارتی برای این کاروان وجود ندارد.';
  }

  private async notifyManagerStatusChanged(
    caravan: {
      name: string;
      manager: { fullName: string; phone: string | null } | null;
    },
    from: CaravanStatus,
    to: CaravanStatus,
    actorId: string,
  ) {
    const phone = caravan.manager?.phone?.trim();
    if (!phone) {
      this.logger.warn(
        `پیامک تغییر وضعیت کاروان «${caravan.name}» ارسال نشد: مدیر شماره همراه ندارد`,
      );
      return;
    }
    const greeting = caravan.manager?.fullName?.trim()
      ? `${caravan.manager.fullName.trim()} گرامی`
      : 'مدیر محترم کاروان';
    const body = [
      'با سلام و احترام',
      greeting,
      '',
      `ستاد جمعیت وضعیت کاروان «${caravan.name}» را به‌روزرسانی کرد.`,
      `از: ${caravanStatusLabel(from)}`,
      `به: ${caravanStatusLabel(to)}`,
      '',
      this.statusChangedClosing(to),
      '',
      'از همراهی شما در خدمت به زائران حضرت امام رضا علیه‌السلام سپاسگزاریم.',
    ].join('\n');
    try {
      await this.sms.send({ phone, body, sentById: actorId });
    } catch (error) {
      this.logger.warn(
        `پیامک تغییر وضعیت کاروان «${caravan.name}» ارسال نشد: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notifyManagerWelcome(
    caravan: {
      name: string;
      foundedYear: number | null;
      city: { nameFa: string; nameEn: string | null };
      manager: { phone: string | null } | null;
    },
    actorId: string,
  ) {
    const phone = caravan.manager?.phone?.trim();
    if (!phone) {
      this.logger.warn(`پیامک خوش‌آمد کاروان «${caravan.name}» ارسال نشد: مدیر شماره همراه ندارد`);
      return;
    }
    const year =
      caravan.foundedYear == null
        ? '—'
        : toPersianDigits(String(caravan.foundedYear));
    const body = [
      'به جمعیت مدیران کاروان سامانه زائرین خوش آمدید',
      `نام کاروان: ${caravan.name}`,
      `سال تأسیس: ${year}`,
      `شهر مبدأ: ${localizedGeoName(caravan.city)}`,
      'وضعیت: در انتظار بررسی',
    ].join('\n');
    try {
      await this.sms.send({ phone, body, sentById: actorId });
    } catch (error) {
      this.logger.warn(
        `پیامک خوش‌آمد کاروان «${caravan.name}» ارسال نشد: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
    const licenseImageIds = this.resolveLicenseImageIds(dto);
    if (licenseImageIds) {
      await this.assertLicenseImages(licenseImageIds);
    }

    let resolved: { managerUserId: string | null } | null = null;
    if (isAdmin(actor)) {
      if (dto.managerUserId !== undefined) {
        resolved = await this.resolveManager(dto.managerUserId);
        if (resolved.managerUserId && resolved.managerUserId !== current.managerUserId) {
          await this.assertCaravanPerNationalId(resolved.managerUserId, actor, id);
        }
      }
    } else if (current.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان ویرایش این کاروان وجود ندارد');
    } else if (dto.managerUserId && dto.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان تغییر مدیر کاروان وجود ندارد');
    }

    const nextStatus = this.resolveStatusUpdate(current, dto.status, actor);

    const caravan = await this.prisma.$transaction(async (tx) => {
      await tx.caravan.update({
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
          licenseNumber:
            dto.licenseNumber === undefined
              ? undefined
              : dto.licenseNumber?.trim() || null,
          managerUserId: resolved ? resolved.managerUserId : undefined,
          eitaa: dto.eitaa === undefined ? undefined : dto.eitaa?.trim() || null,
          bale: dto.bale === undefined ? undefined : dto.bale?.trim() || null,
          telegram:
            dto.telegram === undefined ? undefined : dto.telegram?.trim() || null,
          instagram:
            dto.instagram === undefined
              ? undefined
              : dto.instagram?.trim() || null,
          status: nextStatus,
        },
      });
      if (licenseImageIds) {
        await this.syncLicenseImages(tx, id, licenseImageIds);
      }
      return tx.caravan.findUniqueOrThrow({
        where: { id },
        include: caravanInclude,
      });
    });

    const updated = this.serialize(caravan);
    if (
      isAdmin(actor) &&
      nextStatus &&
      nextStatus !== current.status
    ) {
      await this.notifyManagerStatusChanged(
        updated,
        current.status,
        nextStatus,
        actor.id,
      );
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      const licenses = await tx.issuedLicense.findMany({
        where: { caravanId: id },
        select: { fileId: true },
      });
      const licenseImages = await tx.caravanLicenseImage.findMany({
        where: { caravanId: id },
        select: { imageId: true },
      });
      await tx.issuedLicense.deleteMany({ where: { caravanId: id } });
      const fileIds = [
        ...licenses
          .map((license) => license.fileId)
          .filter((fileId): fileId is string => Boolean(fileId)),
        ...licenseImages.map((image) => image.imageId),
      ];
      await tx.caravan.delete({ where: { id } });
      if (fileIds.length > 0) {
        await tx.storedImage.deleteMany({ where: { id: { in: fileIds } } });
      }
    });
    return { ok: true };
  }

  async report(actor: Actor, year?: number) {
    this.assertAdmin(actor);
    const selectedYear = year ?? currentJalaliYear();
    const items = await this.prisma.caravan.findMany({
      select: {
        id: true,
        managerUserId: true,
        status: true,
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
        reservations: {
          where: {
            year: selectedYear,
            type: ReservationType.CARAVAN,
            status: { notIn: ['CANCELLED', 'REJECTED'] },
          },
          select: {
            maleCount: true,
            femaleCount: true,
            walkingRouteId: true,
            walkingRoute: { select: { id: true, name: true } },
          },
        },
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

    const genderCount = new Map<CaravanGenderKind, number>(
      caravanGenderKinds.map((kind) => [kind, 0]),
    );
    const comboCount = new Map<string, number>();
    const routeCount = new Map<string, { id: string | null; name: string; count: number }>();
    const provinceCount = new Map<string, { id: string; name: string; count: number }>();

    for (const item of items) {
      if (item.managerUserId) withManager += 1;
      else withoutManager += 1;

      const files = item.reservations;
      if (files.length) activeInYear += 1;
      else inactiveInYear += 1;

      const male = files.reduce((sum, row) => sum + row.maleCount, 0);
      const female = files.reduce((sum, row) => sum + row.femaleCount, 0);
      capacityMale += male;
      capacityFemale += female;
      const genderType = caravanGenderKind(male, female);
      genderCount.set(genderType, (genderCount.get(genderType) ?? 0) + 1);

      const origin: CaravanOrigin =
        item.city.province.country.iso2 === 'IR' ? 'IRANIAN' : 'INTERNATIONAL';
      if (origin === 'IRANIAN') iranian += 1;
      else international += 1;

      const comboKey = `${genderType}:${origin}`;
      comboCount.set(comboKey, (comboCount.get(comboKey) ?? 0) + 1);

      const route = files.find((row) => row.walkingRouteId)?.walkingRoute;
      const routeId = route?.id ?? '';
      const routeName = route?.name ?? '';
      const routeRow = routeCount.get(routeId) ?? {
        id: route?.id ?? null,
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
        invalid,
        invalidRows,
        adjusted,
        adjustedRows,
      };
    }

    const [managerRole, iran, fallbackCityId] = await Promise.all([
      this.prisma.role.findUnique({ where: { code: 'CARAVAN_MANAGER' } }),
      this.prisma.country.findUnique({
        where: { iso2: 'IR' },
        select: { id: true },
      }),
      this.resolveFallbackCityId(),
    ]);
    if (!managerRole) {
      throw new BadRequestException('نقش مدیر کاروان در سامانه یافت نشد');
    }
    if (!fallbackCityId) {
      throw new BadRequestException('شهری برای ثبت کاروان در سامانه یافت نشد');
    }

    const cityIds = [
      ...new Set(rows.map((row) => row.cityId).filter((id): id is string => Boolean(id))),
    ];
    const cityGeo = await this.loadCityGeoMap(cityIds);
    const iranCountryId = iran?.id ?? null;

    const existingCaravans = await this.prisma.caravan.findMany({
      select: { id: true, name: true, managerUserId: true },
    });
    const caravanByName = new Map(
      existingCaravans.map((item) => [normalizeCaravanNameKey(item.name), item]),
    );

    const passwordBySecret = new Map<string, string>();
    const conflictRows: CaravanImportIssueRow[] = [];
    let managersCreated = 0;
    let managersReused = 0;
    let caravansCreated = 0;
    let caravansReused = 0;

    for (const row of rows) {
      const manager = await this.resolveImportManager(row, {
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
            status: CaravanStatus.ACTIVE,
          },
          select: { id: true, name: true, managerUserId: true },
        });
        caravan = created;
        caravanByName.set(nameKey, created);
        caravansCreated += 1;
      } else {
        caravansReused += 1;
        if (caravan.managerUserId !== manager.id) {
          await this.prisma.caravan.update({
            where: { id: caravan.id },
            data: { managerUserId: manager.id },
          });
          caravan.managerUserId = manager.id;
        }
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
      await this.users.grantAutoRole(existing.id, 'CARAVAN_MANAGER');
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
            create: [{ roleId: ctx.managerRoleId }],
          },
        },
        select: { id: true },
      });
      return { id: created.id, created: true };
    } catch {
      return { error: 'phoneTaken' };
    }
  }

  async createQuota(
    actor: RoleBearer & { id: string },
    managerUserId?: string,
  ) {
    const targetId =
      isAdmin(actor) && managerUserId ? managerUserId : actor.id;
    return this.caravanNationalIdQuota(targetId);
  }

  private async assertCaravanPerNationalId(
    managerUserId: string | null,
    actor: RoleBearer,
    excludeCaravanId?: string,
  ) {
    if (!managerUserId) return;
    if (isAdmin(actor)) return;
    const quota = await this.caravanNationalIdQuota(managerUserId, excludeCaravanId);
    if (quota.allowed) return;
    throw new BadRequestException(
      'هر کد ملی فقط می‌تواند یک کاروان داشته باشد',
    );
  }

  private async caravanNationalIdQuota(
    managerUserId: string,
    excludeCaravanId?: string,
  ) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: { id: true, nationalId: true },
    });
    const max = 1;
    if (!manager) {
      return { max, used: 0, allowed: true };
    }
    const nationalId = manager.nationalId?.trim() || null;
    const used = await this.prisma.caravan.count({
      where: {
        ...(excludeCaravanId ? { id: { not: excludeCaravanId } } : {}),
        manager: nationalId ? { nationalId } : { id: manager.id },
      },
    });
    return { max, used, allowed: used < max };
  }

  private async resolveManager(managerUserId?: string | null) {
    if (!managerUserId) {
      return { managerUserId: null };
    }

    await this.users.grantAutoRole(managerUserId, 'CARAVAN_MANAGER');
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

  private resolveLicenseImageIds(
    dto: Pick<CreateCaravanDto, 'licenseImageId' | 'licenseImageIds'>,
  ) {
    if (dto.licenseImageIds !== undefined) {
      return [...new Set(dto.licenseImageIds)];
    }
    if (dto.licenseImageId !== undefined) {
      return dto.licenseImageId ? [dto.licenseImageId] : [];
    }
    return undefined;
  }

  private resolveStatusUpdate(
    current: { status: CaravanStatus; managerUserId: string | null },
    next: CaravanStatus | undefined,
    actor: Actor,
  ) {
    if (next === undefined) return undefined;
    if (isAdmin(actor)) return next;
    if (current.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان تغییر وضعیت این کاروان وجود ندارد');
    }
    if (
      current.status === CaravanStatus.PENDING_REVIEW ||
      next === CaravanStatus.PENDING_REVIEW
    ) {
      throw new ForbiddenException(
        'تا تأیید مدیریت امکان تغییر وضعیت کاروان وجود ندارد',
      );
    }
    return next;
  }

  private serialize(row: CaravanRecord) {
    const { licenseImages, ...rest } = row;
    const licenseImageIds = licenseImages.map((image) => image.imageId);
    return {
      ...rest,
      isActive: isCaravanActive(rest.status),
      licenseImageIds,
      licenseImageId: licenseImageIds[0] ?? null,
    };
  }

  private async assertLicenseImages(imageIds: string[]) {
    if (!imageIds.length) return;
    if (imageIds.length > MAX_CARAVAN_LICENSE_IMAGES) {
      throw new BadRequestException('تعداد تصاویر مجوز بیش از حد مجاز است');
    }
    const unique = [...new Set(imageIds)];
    const count = await this.prisma.storedImage.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new BadRequestException('تصویر مجوز معتبر نیست');
    }
  }

  private async syncLicenseImages(
    tx: Prisma.TransactionClient,
    caravanId: string,
    imageIds: string[],
  ) {
    const current = await tx.caravanLicenseImage.findMany({
      where: { caravanId },
      select: { imageId: true },
    });
    const nextIds = [...new Set(imageIds)].slice(0, MAX_CARAVAN_LICENSE_IMAGES);
    const removed = current
      .map((row) => row.imageId)
      .filter((imageId) => !nextIds.includes(imageId));
    await tx.caravanLicenseImage.deleteMany({ where: { caravanId } });
    if (nextIds.length) {
      await tx.caravanLicenseImage.createMany({
        data: nextIds.map((imageId, sortOrder) => ({
          caravanId,
          imageId,
          sortOrder,
        })),
      });
    }
    if (removed.length) {
      await tx.storedImage.deleteMany({ where: { id: { in: removed } } });
    }
  }

}

function toPersianDigits(value: string) {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit);
}
