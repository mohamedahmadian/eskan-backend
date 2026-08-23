import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isAdmin } from '../auth/roles.util';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear, jalaliMonthRange, jalaliYearRange } from '../common/jalali-year';
import { normalizePhone } from '../common/phone';
import {
  containsInsensitive,
  normalizeSearchDigits,
  paginatedResult,
  paginationArgs,
  startsWithInsensitive,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma, Religion, UserGender, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SetPilgrimPasswordDto } from './dto/set-pilgrim-password.dto';
import {
  CITY_ID_NONE,
  FindUsersQueryDto,
} from './dto/find-users-query.dto';
import {
  parsePilgrimImportExcel,
  type PilgrimImportIssueRow,
  type PilgrimImportRow,
  type ParsedPilgrimImport,
} from './pilgrim-excel-import.util';
import { resolvePilgrimResetPassword } from './pilgrim-password.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { cleanPlates, joinFullName } from './user-profile.util';

function parseDateOnly(value?: string | null) {
  if (value == null || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

function toDateOnly(value?: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const roleSelect = {
  id: true,
  code: true,
  nameKey: true,
} satisfies Prisma.RoleSelect;

const geoSelect = {
  id: true,
  nameFa: true,
  nameEn: true,
} satisfies Prisma.CountrySelect;

const publicInclude = {
  userRoles: {
    include: { role: { select: roleSelect } },
  },
  country: { select: geoSelect },
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
  managedAccommodations: {
    where: { isPrimary: true },
    orderBy: { year: 'desc' as const },
    take: 1,
    include: {
      accommodation: { select: { id: true, name: true } },
    },
  },
  representedProvinces: {
    orderBy: { nameFa: 'asc' as const },
    select: { id: true, nameFa: true, nameEn: true },
  },
  representedCities: {
    orderBy: { nameFa: 'asc' as const },
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
      province: { select: geoSelect },
    },
  },
  _count: {
    select: {
      managedAccommodations: true,
      representedProvinces: true,
      representedCities: true,
    },
  },
} satisfies Prisma.UserInclude;

type PublicUserSource = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  locale: string;
  status: UserStatus;
  gender: UserGender | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  address: string | null;
  notes: string | null;
  religion: Religion | null;
  religionOther: string | null;
  telegram: string | null;
  bale: string | null;
  eitaa: string | null;
  whatsapp: string | null;
  otherSocial: string | null;
  vehiclePlates: string[];
  countryId: string | null;
  provinceId: string | null;
  cityId: string | null;
  photoId: string | null;
  nationalCardPhotoId: string | null;
  passportPhotoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; nameFa: string; nameEn: string } | null;
  province: { id: string; nameFa: string; nameEn: string; countryId: string } | null;
  city: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
  userRoles: { role: { id: string; code: string; nameKey: string } }[];
  managedAccommodations: {
    id: string;
    year: number;
    isPrimary: boolean;
    createdAt: Date;
    accommodation: { id: string; name: string; type?: string; status?: string };
  }[];
  representedProvinces: { id: string; nameFa: string; nameEn: string }[];
  representedCities: {
    id: string;
    nameFa: string;
    nameEn: string;
    provinceId: string;
    province: { id: string; nameFa: string; nameEn: string };
  }[];
  _count: {
    managedAccommodations: number;
    representedProvinces: number;
    representedCities: number;
  };
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: roleSelect,
    });
  }

  countByRole(roleCode: string) {
    return this.prisma.user.count({
      where: { userRoles: { some: { role: { code: roleCode } } } },
    });
  }

  private pilgrimScope(year?: number): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { code: 'PILGRIM' } } },
    };
    if (year != null) {
      const { gte, lt } = jalaliYearRange(year);
      where.createdAt = { gte, lt };
    }
    return where;
  }

  async pilgrimReportSummary(year?: number) {
    const where = this.pilgrimScope(year);
    const [total, genderRows, statusRows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['gender'],
        where,
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    let male = 0;
    let female = 0;
    let unspecified = 0;
    for (const row of genderRows) {
      if (row.gender === UserGender.MALE) male = row._count._all;
      else if (row.gender === UserGender.FEMALE) female = row._count._all;
      else unspecified += row._count._all;
    }

    let active = 0;
    let inactive = 0;
    for (const row of statusRows) {
      if (row.status === UserStatus.ACTIVE) active = row._count._all;
      else inactive += row._count._all;
    }

    return {
      year: year ?? null,
      total,
      byGender: { male, female, unspecified },
      byStatus: { active, inactive },
    };
  }

  async pilgrimReportGeo(year?: number) {
    const where = this.pilgrimScope(year);
    const unspecifiedId = '__unspecified__';
    const [
      countryRows,
      provinceRows,
      cityRows,
      unspecifiedCountry,
      unspecifiedProvince,
      unspecifiedCity,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['countryId'],
        where: { ...where, countryId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['provinceId'],
        where: { ...where, provinceId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['cityId'],
        where: { ...where, cityId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { ...where, countryId: null } }),
      this.prisma.user.count({ where: { ...where, provinceId: null } }),
      this.prisma.user.count({ where: { ...where, cityId: null } }),
    ]);

    const countryIds = countryRows.map((row) => row.countryId!).filter(Boolean);
    const provinceIds = provinceRows.map((row) => row.provinceId!).filter(Boolean);
    const cityIds = cityRows.map((row) => row.cityId!).filter(Boolean);

    const [countries, provinces, cities] = await Promise.all([
      countryIds.length
        ? this.prisma.country.findMany({
            where: { id: { in: countryIds } },
            select: { id: true, nameFa: true },
          })
        : Promise.resolve([]),
      provinceIds.length
        ? this.prisma.province.findMany({
            where: { id: { in: provinceIds } },
            select: { id: true, nameFa: true },
          })
        : Promise.resolve([]),
      cityIds.length
        ? this.prisma.city.findMany({
            where: { id: { in: cityIds } },
            select: { id: true, nameFa: true },
          })
        : Promise.resolve([]),
    ]);

    const countryName = new Map(countries.map((item) => [item.id, item.nameFa]));
    const provinceName = new Map(provinces.map((item) => [item.id, item.nameFa]));
    const cityName = new Map(cities.map((item) => [item.id, item.nameFa]));

    const sortByCountDesc = <T extends { count: number }>(items: T[]) =>
      [...items].sort((a, b) => b.count - a.count);

    const withUnspecified = (
      rows: { id: string; name: string; count: number }[],
      nullCount: number,
      orphanCount: number,
    ) => {
      const unspecifiedCount = nullCount + orphanCount;
      if (unspecifiedCount <= 0) return sortByCountDesc(rows);
      return sortByCountDesc([
        ...rows,
        { id: unspecifiedId, name: unspecifiedId, count: unspecifiedCount },
      ]);
    };

    let orphanCountry = 0;
    const byCountry = countryRows.flatMap((row) => {
      if (row.countryId && countryName.has(row.countryId)) {
        return [
          {
            id: row.countryId,
            name: countryName.get(row.countryId)!,
            count: row._count._all,
          },
        ];
      }
      orphanCountry += row._count._all;
      return [];
    });

    let orphanProvince = 0;
    const byProvince = provinceRows.flatMap((row) => {
      if (row.provinceId && provinceName.has(row.provinceId)) {
        return [
          {
            id: row.provinceId,
            name: provinceName.get(row.provinceId)!,
            count: row._count._all,
          },
        ];
      }
      orphanProvince += row._count._all;
      return [];
    });

    let orphanCity = 0;
    const byCity = cityRows.flatMap((row) => {
      if (row.cityId && cityName.has(row.cityId)) {
        return [
          {
            id: row.cityId,
            name: cityName.get(row.cityId)!,
            count: row._count._all,
          },
        ];
      }
      orphanCity += row._count._all;
      return [];
    });

    return {
      year: year ?? null,
      byCountry: withUnspecified(byCountry, unspecifiedCountry, orphanCountry),
      byProvince: withUnspecified(byProvince, unspecifiedProvince, orphanProvince),
      byCity: withUnspecified(byCity, unspecifiedCity, orphanCity),
    };
  }

  async pilgrimReportReligion(year?: number) {
    const where = this.pilgrimScope(year);
    const religionRows = await this.prisma.user.groupBy({
      by: ['religion'],
      where: { ...where, religion: { not: null } },
      _count: { _all: true },
    });

    return {
      year: year ?? null,
      byReligion: religionRows
        .filter((row) => row.religion != null)
        .map((row) => ({
          religion: row.religion as Religion,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async pilgrimReportTimeline(year?: number) {
    const pilgrimRole: Prisma.UserWhereInput = {
      userRoles: { some: { role: { code: 'PILGRIM' } } },
    };

    if (year != null) {
      const byMonth = await Promise.all(
        Array.from({ length: 12 }, async (_, index) => {
          const month = index + 1;
          const { gte, lt } = jalaliMonthRange(year, month);
          const count = await this.prisma.user.count({
            where: { ...pilgrimRole, createdAt: { gte, lt } },
          });
          return { month, count };
        }),
      );
      return {
        year,
        byYear: [] as { year: number; count: number }[],
        byMonth: byMonth.filter((row) => row.count > 0),
      };
    }

    const bounds = await this.prisma.user.aggregate({
      where: pilgrimRole,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    if (!bounds._min.createdAt || !bounds._max.createdAt) {
      return {
        year: null,
        byYear: [] as { year: number; count: number }[],
        byMonth: [] as { month: number; count: number }[],
      };
    }

    const fromYear = currentJalaliYear(bounds._min.createdAt);
    const toYear = currentJalaliYear(bounds._max.createdAt);
    const byYear = await Promise.all(
      Array.from({ length: Math.max(0, toYear - fromYear + 1) }, async (_, index) => {
        const jalaliYear = fromYear + index;
        const { gte, lt } = jalaliYearRange(jalaliYear);
        const count = await this.prisma.user.count({
          where: { ...pilgrimRole, createdAt: { gte, lt } },
        });
        return { year: jalaliYear, count };
      }),
    );

    return {
      year: null,
      byYear: byYear.filter((row) => row.count > 0),
      byMonth: [] as { month: number; count: number }[],
    };
  }

  async pilgrimReport(year?: number) {
    const [summary, geo, religion, timeline] = await Promise.all([
      this.pilgrimReportSummary(year),
      this.pilgrimReportGeo(year),
      this.pilgrimReportReligion(year),
      this.pilgrimReportTimeline(year),
    ]);

    return {
      ...summary,
      ...geo,
      ...religion,
      byYear: timeline.byYear,
      byMonth: timeline.byMonth,
    };
  }

  async findAll(query: FindUsersQueryDto) {
    const where = this.listWhere(query);
    const findMany = {
      where,
      orderBy: this.listOrderBy(query),
      include: publicInclude,
    };

    if (!wantsPagination(query)) {
      const items = await this.prisma.user.findMany(findMany);
      return items.map((item) => this.toPublicUser(item));
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ ...findMany, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return paginatedResult(
      items.map((item) => this.toPublicUser(item)),
      total,
      page,
      pageSize,
    );
  }

  async exportExcel(query: FindUsersQueryDto) {
    const where = this.listWhere(query);
    const items = await this.prisma.user.findMany({
      where,
      orderBy: this.listOrderBy(query),
      include: publicInclude,
    });
    return this.buildUsersExcel(items.map((item) => this.toPublicUser(item)));
  }

  private listOrderBy(
    query: FindUsersQueryDto,
  ): Prisma.UserOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.UserOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        fullName: (dir) => ({ fullName: dir }),
        username: (dir) => ({ username: dir }),
        phone: (dir) => ({ phone: dir }),
        status: (dir) => ({ status: dir }),
        nationalId: (dir) => ({ nationalId: dir }),
        city: (dir) => ({ city: { nameFa: dir } }),
        accommodationCount: (dir) => ({
          managedAccommodations: { _count: dir },
        }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...publicInclude,
        managedAccommodations: {
          orderBy: [{ year: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            accommodation: {
              select: { id: true, name: true, type: true, status: true },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return this.toPublicUser(user, true);
  }

  async create(dto: CreateUserDto) {
    const roleIds = await this.assertRolesExist(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const geo = await this.resolveGeo(dto);
    await this.assertImages(dto);
    await this.assertUniqueIdentity(dto);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...(this.toUserData(dto, geo) as Prisma.UserUncheckedCreateInput),
          username: dto.username.trim(),
          passwordHash,
          locale: dto.locale ?? 'fa',
          status: dto.status ?? UserStatus.ACTIVE,
          userRoles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: publicInclude,
      });
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const current = await this.findOne(id);

    if (dto.roleIds) {
      await this.assertRolesExist(dto.roleIds);
      await this.assertNotLastAdmin(current, dto.roleIds);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;
    const geo = await this.resolveGeo({
      countryId: dto.countryId === undefined ? current.countryId : dto.countryId,
      provinceId: dto.provinceId === undefined ? current.provinceId : dto.provinceId,
      cityId: dto.cityId === undefined ? current.cityId : dto.cityId,
    });
    await this.assertImages(dto);
    await this.assertUniqueIdentity(dto, id);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (dto.roleIds) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(this.toUserData(dto, geo) as Prisma.UserUncheckedUpdateInput),
            username: dto.username?.trim(),
            passwordHash,
            locale: dto.locale,
          },
          include: publicInclude,
        });
      });
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('امکان حذف حساب خودتان وجود ندارد');
    }

    const current = await this.findOne(id);
    await this.assertNotLastAdmin(current);

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async ensureRole(userId: string, roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    return role;
  }

  async createWithRole(dto: CreateUserDto, roleCode: string) {
    const role = await this.ensureExistingRole(roleCode);
    const roleIds = [...new Set([...(dto.roleIds ?? []), role.id])];
    return this.create({ ...dto, roleIds });
  }

  async updateKeepingRole(id: string, dto: UpdateUserDto, roleCode: string) {
    await this.assertHasRole(id, roleCode);
    if (dto.roleIds) {
      const role = await this.ensureExistingRole(roleCode);
      if (!dto.roleIds.includes(role.id)) {
        dto = { ...dto, roleIds: [...dto.roleIds, role.id] };
      }
    }
    return this.update(id, dto);
  }

  async removeRole(userId: string, roleCode: string, actorId: string) {
    const current = await this.findOne(userId);
    const remainingIds = current.roles
      .filter((role) => role.code !== roleCode)
      .map((role) => role.id);

    if (remainingIds.length === current.roles.length) {
      return this.findOne(userId);
    }

    if (remainingIds.length === 0) {
      return this.remove(userId, actorId);
    }

    await this.assertNotLastAdmin(current, remainingIds);
    await this.prisma.$transaction(async (tx) => {
      if (roleCode === 'ACCOMMODATION_MANAGER') {
        await tx.accommodationManager.deleteMany({ where: { userId } });
      }
      if (roleCode === 'HEADQUARTERS_REPRESENTATIVE') {
        await tx.province.updateMany({
          where: { representativeId: userId },
          data: { representativeId: null },
        });
        await tx.city.updateMany({
          where: { representativeId: userId },
          data: { representativeId: null },
        });
      }
      await tx.userRole.deleteMany({
        where: { userId, role: { code: roleCode } },
      });
    });
    return this.findOne(userId);
  }

  async assertHasRole(id: string, roleCode: string, notFoundMessage = 'کاربر یافت نشد') {
    const user = await this.findOne(id);
    if (!user.roles.some((role) => role.code === roleCode)) {
      throw new NotFoundException(notFoundMessage);
    }
    return user;
  }

  async setPilgrimPassword(id: string, dto: SetPilgrimPasswordDto, actorId: string) {
    const user = await this.assertHasRole(id, 'PILGRIM', 'زائر یافت نشد');
    if (dto.sendSms && !user.phone) {
      throw new BadRequestException('شماره همراه زائر ثبت نشده است');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    let smsQueued = false;
    if (dto.sendSms && user.phone) {
      try {
        await this.sms.send({
          phone: user.phone,
          body: [
            `زائر گرامی ${user.fullName}`,
            'رمز عبور جدید سامانه اسکان:',
            dto.password,
            'ورود با کد ملی یا شماره همراه',
          ].join('\n'),
          sentById: actorId,
        });
        smsQueued = true;
      } catch {
        // رمز ذخیره شده؛ خطا در پیامک مانع تعریف رمز نمی‌شود
      }
    }

    return { ok: true, smsQueued };
  }

  async recoverOwnPilgrimPassword(userId: string) {
    const user = await this.assertHasRole(userId, 'PILGRIM', 'زائر یافت نشد');
    if (!user.phone) {
      throw new BadRequestException('شماره همراه برای ارسال پیامک ثبت نشده است');
    }

    await this.sms.assertConfigured();
    const password = resolvePilgrimResetPassword(user.nationalId);
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.sms.send({
      phone: user.phone,
      body: [
        `زائر گرامی ${user.fullName}`,
        'رمز عبور جدید سامانه اسکان:',
        password,
        'ورود با کد ملی یا شماره همراه',
      ].join('\n'),
      sentById: userId,
    });

    return { ok: true };
  }

  async assignProvince(userId: string, provinceId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      include: { representative: { select: { fullName: true } } },
    });
    if (!province) {
      throw new BadRequestException('استان انتخاب‌شده معتبر نیست');
    }
    if (province.representativeId && province.representativeId !== userId) {
      throw new ConflictException(
        `این استان هم‌اکنون نماینده دارد (${province.representative?.fullName ?? ''})`,
      );
    }
    if (province.representativeId !== userId) {
      await this.prisma.province.update({
        where: { id: provinceId },
        data: { representativeId: userId },
      });
    }
    return this.findOne(userId);
  }

  async unassignProvince(userId: string, provinceId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const province = await this.prisma.province.findUnique({ where: { id: provinceId } });
    if (!province || province.representativeId !== userId) {
      throw new NotFoundException('این استان به این نماینده اختصاص داده نشده است');
    }
    await this.prisma.province.update({
      where: { id: provinceId },
      data: { representativeId: null },
    });
    return this.findOne(userId);
  }

  async assignCity(userId: string, cityId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: {
        representative: { select: { fullName: true } },
        province: { select: { representativeId: true, nameFa: true } },
      },
    });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (!city.province.representativeId) {
      throw new BadRequestException(
        'تا وقتی نماینده استان تعیین نشده، این شهر نماینده ستاد ندارد',
      );
    }
    if (city.representativeId && city.representativeId !== userId) {
      throw new ConflictException(
        `این شهر هم‌اکنون نماینده دارد (${city.representative?.fullName ?? ''})`,
      );
    }
    if (city.representativeId !== userId) {
      await this.prisma.city.update({
        where: { id: cityId },
        data: { representativeId: userId },
      });
    }
    return this.findOne(userId);
  }

  async assignAccommodation(userId: string, accommodationId: string, year: number) {
    await this.assertHasRole(userId, 'ACCOMMODATION_MANAGER', 'مدیر اسکان یافت نشد');
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id: accommodationId },
      select: { id: true },
    });
    if (!accommodation) {
      throw new BadRequestException('اسکان انتخاب‌شده معتبر نیست');
    }

    const existing = await this.prisma.accommodationManager.findUnique({
      where: {
        userId_accommodationId_year: { userId, accommodationId, year },
      },
    });
    if (existing) {
      throw new ConflictException('این اسکان برای این سال قبلاً به این مدیر تخصیص داده شده است');
    }

    const hasPrimaryThisYear = await this.prisma.accommodationManager.findFirst({
      where: { userId, year, isPrimary: true },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.accommodationManager.deleteMany({
        where: { accommodationId, year, userId: null },
      });
      await tx.accommodationManager.create({
        data: {
          userId,
          accommodationId,
          year,
          isPrimary: !hasPrimaryThisYear,
        },
      });
    });
    return this.findOne(userId);
  }

  async unassignAccommodation(userId: string, assignmentId: string) {
    await this.assertHasRole(userId, 'ACCOMMODATION_MANAGER', 'مدیر اسکان یافت نشد');
    const link = await this.prisma.accommodationManager.findFirst({
      where: { id: assignmentId, userId },
    });
    if (!link) {
      throw new NotFoundException('این تخصیص یافت نشد');
    }
    await this.prisma.accommodationManager.delete({ where: { id: assignmentId } });
    return this.findOne(userId);
  }

  async unassignCity(userId: string, cityId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city || city.representativeId !== userId) {
      throw new NotFoundException('این شهر به این نماینده اختصاص داده نشده است');
    }
    await this.prisma.city.update({
      where: { id: cityId },
      data: { representativeId: null },
    });
    return this.findOne(userId);
  }

  private async ensureExistingRole(roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    return role;
  }

  /**
   * Fast path for nationalId/phone (unique btree / prefix), otherwise
   * trigram-friendly contains on name + identity fields. Headquarters
   * lists keep geo relation search; other role lists skip social/role OR.
   */
  private searchWhere(
    q: string,
    headquartersOnly: boolean,
  ): Prisma.UserWhereInput {
    const digits = normalizeSearchDigits(q);
    const mostlyDigits =
      digits.length >= 7 && digits.length / Math.max(q.replace(/\s/g, '').length, 1) >= 0.8;

    if (mostlyDigits) {
      return {
        OR: [
          { nationalId: digits },
          { phone: digits },
          { nationalId: startsWithInsensitive(digits) },
          { phone: startsWithInsensitive(digits) },
          { username: startsWithInsensitive(digits) },
        ],
      };
    }

    const text = containsInsensitive(q);
    const core: Prisma.UserWhereInput[] = [
      { username: text },
      { firstName: text },
      { lastName: text },
      { fullName: text },
      { nationalId: text },
      { phone: text },
      { email: text },
      { notes: text },
    ];

    if (!headquartersOnly) {
      return { OR: core };
    }

    const geoName = {
      OR: [{ nameFa: text }, { nameEn: text }],
    };
    return {
      OR: [
        ...core,
        { address: text },
        { telegram: text },
        { bale: text },
        { eitaa: text },
        { whatsapp: text },
        { otherSocial: text },
        {
          userRoles: {
            some: {
              role: {
                OR: [{ nameKey: text }, { code: text }],
              },
            },
          },
        },
        { representedProvinces: { some: geoName } },
        {
          representedCities: {
            some: {
              ...geoName,
              province: { representativeId: { not: null } },
            },
          },
        },
        {
          representedProvinces: {
            some: {
              cities: { some: { representativeId: null, ...geoName } },
            },
          },
        },
      ],
    };
  }

  private listWhere(query: FindUsersQueryDto): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [];
    const roleCodes = query.roleCodes?.length
      ? query.roleCodes
      : query.roleCode
        ? [query.roleCode]
        : [];
    if (roleCodes.length) {
      filters.push({
        userRoles: { some: { role: { code: { in: roleCodes } } } },
      });
    }

    const headquartersOnly =
      roleCodes.length === 1 && roleCodes[0] === 'HEADQUARTERS_REPRESENTATIVE';

    if (headquartersOnly) {
      if (query.provinceId) {
        filters.push({
          OR: [
            { representedProvinces: { some: { id: query.provinceId } } },
            { representedCities: { some: { provinceId: query.provinceId } } },
          ],
        });
      }
      if (query.cityId && query.cityId !== CITY_ID_NONE) {
        filters.push({
          OR: [
            {
              representedCities: {
                some: {
                  id: query.cityId,
                  province: { representativeId: { not: null } },
                },
              },
            },
            {
              representedProvinces: {
                some: {
                  cities: { some: { id: query.cityId, representativeId: null } },
                },
              },
            },
          ],
        });
      }
    } else {
      if (query.countryId) {
        filters.push({ countryId: query.countryId });
      }
      if (query.provinceId) {
        filters.push({ provinceId: query.provinceId });
      }
      if (query.cityId === CITY_ID_NONE) {
        filters.push({ cityId: null });
      } else if (query.cityId) {
        filters.push({ cityId: query.cityId });
      }
    }

    if (query.gender) {
      filters.push({ gender: query.gender });
    }
    if (query.notes) {
      filters.push({ notes: containsInsensitive(query.notes) });
    }

    if (query.q) {
      filters.push(this.searchWhere(query.q.trim(), headquartersOnly));
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private toUserData(
    dto: CreateUserDto | UpdateUserDto,
    geo: { countryId: string | null; provinceId: string | null; cityId: string | null },
  ) {
    const firstName = dto.firstName?.trim()
    const lastName = dto.lastName?.trim()
    const fullName =
      firstName != null && lastName != null
        ? joinFullName(firstName, lastName)
        : undefined
    const data: Record<string, unknown> = {
      countryId: geo.countryId,
      provinceId: geo.provinceId,
      cityId: geo.cityId,
    }

    const set = (key: string, value: unknown) => {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    };

    set('firstName', firstName);
    set('lastName', lastName);
    set('fullName', fullName);
    set('status', dto.status);
    set('gender', dto.gender);
    set('nationalId', dto.nationalId);
    set('phone', dto.phone);
    set('birthDate', dto.birthDate === undefined ? undefined : parseDateOnly(dto.birthDate));
    set('email', dto.email);
    set('address', dto.address);
    set('notes', dto.notes);
    set('religion', dto.religion);
    if (dto.religion !== undefined && dto.religion !== Religion.OTHER) {
      set('religionOther', null);
    } else {
      set('religionOther', dto.religionOther);
    }
    set('telegram', dto.telegram);
    set('bale', dto.bale);
    set('eitaa', dto.eitaa);
    set('whatsapp', dto.whatsapp);
    set('otherSocial', dto.otherSocial);
    set('vehiclePlates', cleanPlates(dto.vehiclePlates));
    set('photoId', dto.photoId);
    set('nationalCardPhotoId', dto.nationalCardPhotoId);
    set('passportPhotoId', dto.passportPhotoId);

    return data;
  }

  private toPublicUser(user: PublicUserSource, withAccommodations = false) {
    const primary = user.managedAccommodations.find((item) => item.isPrimary);
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      locale: user.locale,
      status: user.status,
      gender: user.gender,
      nationalId: user.nationalId,
      phone: user.phone,
      birthDate: toDateOnly(user.birthDate),
      email: user.email,
      address: user.address,
      notes: user.notes,
      religion: user.religion,
      religionOther: user.religionOther,
      telegram: user.telegram,
      bale: user.bale,
      eitaa: user.eitaa,
      whatsapp: user.whatsapp,
      otherSocial: user.otherSocial,
      vehiclePlates: user.vehiclePlates,
      countryId: user.countryId,
      provinceId: user.provinceId,
      cityId: user.cityId,
      country: user.country,
      province: user.province,
      city: user.city,
      photoId: user.photoId,
      nationalCardPhotoId: user.nationalCardPhotoId,
      passportPhotoId: user.passportPhotoId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((item) => item.role),
      accommodationCount: user._count.managedAccommodations,
      representedProvinceCount: user._count.representedProvinces,
      representedCityCount: user._count.representedCities,
      representedProvinces: user.representedProvinces,
      representedCities: user.representedCities,
      primaryAccommodation: primary?.accommodation ?? null,
      accommodations: withAccommodations
        ? user.managedAccommodations.map((item) => ({
            id: item.id,
            year: item.year,
            isPrimary: item.isPrimary,
            createdAt: item.createdAt,
            accommodation: item.accommodation,
          }))
        : undefined,
    };
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
    const iranId = await this.resolveIranCountryId();
    return {
      cityId: null,
      provinceId: null,
      countryId: iranId,
    };
  }

  private async resolveIranCountryId() {
    const iran = await this.prisma.country.findUnique({
      where: { iso2: 'IR' },
      select: { id: true },
    });
    if (!iran) {
      throw new BadRequestException('کشور ایران در سامانه یافت نشد');
    }
    return iran.id;
  }

  private async assertImages(dto: CreateUserDto | UpdateUserDto) {
    const ids = [dto.photoId, dto.nationalCardPhotoId, dto.passportPhotoId].filter(
      (id): id is string => Boolean(id),
    );
    if (!ids.length) {
      return;
    }
    const images = await this.prisma.storedImage.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (images.length !== [...new Set(ids)].length) {
      throw new BadRequestException('تصویر انتخاب‌شده معتبر نیست');
    }
  }

  private async assertRolesExist(roleIds: string[]) {
    const uniqueIds = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (roles.length !== uniqueIds.length) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    return uniqueIds;
  }

  private async assertNotLastAdmin(
    current: { roles: { id: string; code: string }[] },
    nextRoleIds?: string[],
  ) {
    if (!isAdmin(current)) {
      return;
    }

    if (nextRoleIds) {
      const nextRoles = await this.prisma.role.findMany({
        where: { id: { in: nextRoleIds } },
        select: { code: true },
      });
      if (nextRoles.some((role) => role.code === 'ADMIN')) {
        return;
      }
    }

    const adminCount = await this.prisma.user.count({
      where: { userRoles: { some: { role: { code: 'ADMIN' } } } },
    });
    if (adminCount <= 1) {
      throw new BadRequestException(
        'نمی‌توان آخرین مدیر سامانه را حذف یا تغییر نقش داد',
      );
    }
  }

  async checkIdentityTaken(dto: {
    nationalId?: string;
    phone?: string;
    excludeId?: string;
  }) {
    const nationalId = dto.nationalId?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if (!nationalId && !phone) {
      throw new BadRequestException('کد ملی یا شماره تلفن لازم است');
    }

    const [nationalIdHit, phoneHit] = await Promise.all([
      nationalId
        ? this.prisma.user.findFirst({
            where: {
              nationalId,
              ...(dto.excludeId ? { NOT: { id: dto.excludeId } } : {}),
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      phone
        ? this.prisma.user.findFirst({
            where: {
              phone,
              ...(dto.excludeId ? { NOT: { id: dto.excludeId } } : {}),
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      taken: Boolean(nationalIdHit || phoneHit),
      nationalIdTaken: Boolean(nationalIdHit),
      phoneTaken: Boolean(phoneHit),
    };
  }

  async findByIdentity(dto: {
    nationalId?: string;
    phone?: string;
    excludeId?: string;
  }) {
    const nationalId = dto.nationalId?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if (!nationalId && !phone) {
      throw new BadRequestException('کد ملی یا شماره تلفن لازم است');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        ...(dto.excludeId ? { NOT: { id: dto.excludeId } } : {}),
        OR: [
          ...(nationalId ? [{ nationalId }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: publicInclude,
    });

    if (!existing) {
      return { found: false as const };
    }

    return {
      found: true as const,
      user: this.toPublicUser(existing),
    };
  }

  async previewPilgrimImport(buffer: Buffer) {
    const parsed = await this.preparePilgrimImport(buffer);
    return {
      total: parsed.rows.length,
      invalid: parsed.invalid,
      invalidRows: parsed.invalidRows,
      adjusted: parsed.adjusted,
      adjustedRows: parsed.adjustedRows,
    };
  }

  async importPilgrimsFromExcel(buffer: Buffer) {
    const { rows, invalid, invalidRows, adjusted, adjustedRows } =
      await this.preparePilgrimImport(buffer);

    if (!rows.length) {
      return {
        total: 0,
        created: 0,
        updated: 0,
        invalid,
        invalidRows,
        adjusted,
        adjustedRows,
      };
    }

    const role = await this.ensureExistingRole('PILGRIM');
    const iranCountryId = await this.resolveIranCountryId();
    const passwordHash = await bcrypt.hash('11111111', 8);

    const cityIds = [
      ...new Set(
        rows
          .map((row) => row.cityId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const cityGeo = await this.loadCityGeoMap(cityIds);

    const phones = [...new Set(rows.map((row) => row.phone))];
    const nationalIds = [
      ...new Set(
        rows
          .map((row) => row.nationalId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const existingByPhone = new Map<string, { id: string; phone: string | null; nationalId: string | null }>();
    const existingByNationalId = new Map<
      string,
      { id: string; phone: string | null; nationalId: string | null }
    >();

    for (const phoneChunk of chunkArray(phones, 2000)) {
      const found = await this.prisma.user.findMany({
        where: { phone: { in: phoneChunk } },
        select: { id: true, phone: true, nationalId: true },
      });
      for (const user of found) {
        if (user.phone) existingByPhone.set(user.phone, user);
        if (user.nationalId) existingByNationalId.set(user.nationalId, user);
      }
    }
    for (const nationalChunk of chunkArray(nationalIds, 2000)) {
      const found = await this.prisma.user.findMany({
        where: { nationalId: { in: nationalChunk } },
        select: { id: true, phone: true, nationalId: true },
      });
      for (const user of found) {
        if (user.phone) existingByPhone.set(user.phone, user);
        if (user.nationalId) existingByNationalId.set(user.nationalId, user);
      }
    }

    type UpdateItem = {
      id: string;
      row: PilgrimImportRow;
    };

    const toUpdate: UpdateItem[] = [];
    const toCreate: PilgrimImportRow[] = [];
    const conflictRows: PilgrimImportIssueRow[] = [];
    const seenPhones = new Set<string>();
    const seenNationalIds = new Set<string>();

    for (const row of rows) {
      if (seenPhones.has(row.phone)) continue;
      if (row.nationalId && seenNationalIds.has(row.nationalId)) continue;
      seenPhones.add(row.phone);
      if (row.nationalId) seenNationalIds.add(row.nationalId);

      const byNational =
        row.nationalId && existingByNationalId.get(row.nationalId);
      const byPhone = existingByPhone.get(row.phone);

      if (byNational) {
        const phoneOwner = existingByPhone.get(row.phone);
        if (phoneOwner && phoneOwner.id !== byNational.id) {
          conflictRows.push({
            rowNumber: row.rowNumber,
            firstName: row.firstName,
            lastName: row.lastName,
            gender: row.gender,
            phone: row.phone,
            nationalId: row.nationalId ?? '',
            birthDate: row.birthDate ?? '',
            city: row.cityName ?? '',
            reasons: ['phoneTaken'],
          });
          continue;
        }
        toUpdate.push({ id: byNational.id, row });
        continue;
      }
      if (byPhone) {
        if (
          row.nationalId &&
          byPhone.nationalId &&
          row.nationalId !== byPhone.nationalId
        ) {
          conflictRows.push({
            rowNumber: row.rowNumber,
            firstName: row.firstName,
            lastName: row.lastName,
            gender: row.gender,
            phone: row.phone,
            nationalId: row.nationalId,
            birthDate: row.birthDate ?? '',
            city: row.cityName ?? '',
            reasons: ['phoneTaken'],
          });
          continue;
        }
        toUpdate.push({ id: byPhone.id, row });
        continue;
      }
      toCreate.push(row);
    }

    const created = await this.batchCreatePilgrimsFromImport(
      toCreate,
      role.id,
      passwordHash,
      cityGeo,
      iranCountryId,
    );
    const updated = await this.batchUpdatePilgrimsFromImport(
      toUpdate,
      role.id,
      cityGeo,
    );

    const allInvalidRows = [...invalidRows, ...conflictRows].sort(
      (a, b) => a.rowNumber - b.rowNumber,
    );

    return {
      total: rows.length,
      created,
      updated,
      invalid: allInvalidRows.length,
      invalidRows: allInvalidRows,
      adjusted,
      adjustedRows,
    };
  }

  private async loadCityGeoMap(cityIds: string[]) {
    const map = new Map<string, { provinceId: string; countryId: string }>();
    for (const chunk of chunkArray(cityIds, 2000)) {
      if (!chunk.length) continue;
      const cities = await this.prisma.city.findMany({
        where: { id: { in: chunk } },
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
    }
    return map;
  }

  private async batchCreatePilgrimsFromImport(
    rows: PilgrimImportRow[],
    roleId: string,
    passwordHash: string,
    cityGeo: Map<string, { provinceId: string; countryId: string }>,
    iranCountryId: string,
  ) {
    if (!rows.length) return 0;

    const desiredUsernames = rows.map((row) => row.nationalId || row.phone);
    const takenUsernames = new Set<string>();
    for (const chunk of chunkArray(desiredUsernames, 2000)) {
      const found = await this.prisma.user.findMany({
        where: { username: { in: chunk } },
        select: { username: true },
      });
      for (const item of found) takenUsernames.add(item.username);
    }

    const batchStamp = Date.now().toString(36);
    const createData: Prisma.UserCreateManyInput[] = [];
    const phonesInOrder: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const identity = row.nationalId || row.phone;
      let username = identity;
      if (takenUsernames.has(username)) {
        username = `${identity}_${batchStamp}_${index.toString(36)}`;
      }
      takenUsernames.add(username);

      const geo = row.cityId ? cityGeo.get(row.cityId) : undefined;
      createData.push({
        username,
        passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: joinFullName(row.firstName, row.lastName),
        locale: 'fa',
        status: UserStatus.ACTIVE,
        gender: row.gender,
        nationalId: row.nationalId,
        phone: row.phone,
        birthDate: parseDateOnly(row.birthDate),
        cityId: row.cityId ?? null,
        provinceId: geo?.provinceId ?? null,
        countryId: geo?.countryId ?? iranCountryId,
      });
      phonesInOrder.push(row.phone);
    }

    let created = 0;
    for (const chunk of chunkArray(createData, 1000)) {
      const result = await this.prisma.user.createMany({ data: chunk });
      created += result.count;
    }

    const createdIds: string[] = [];
    for (const phoneChunk of chunkArray(phonesInOrder, 2000)) {
      const users = await this.prisma.user.findMany({
        where: { phone: { in: phoneChunk } },
        select: { id: true },
      });
      for (const user of users) createdIds.push(user.id);
    }

    for (const idChunk of chunkArray(createdIds, 2000)) {
      if (!idChunk.length) continue;
      await this.prisma.userRole.createMany({
        data: idChunk.map((userId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }

    return created;
  }

  private async batchUpdatePilgrimsFromImport(
    items: Array<{ id: string; row: PilgrimImportRow }>,
    roleId: string,
    cityGeo: Map<string, { provinceId: string; countryId: string }>,
  ) {
    if (!items.length) return 0;

    for (const chunk of chunkArray(items, 200)) {
      await this.prisma.$transaction(
        chunk.map((item) => {
          const geo = item.row.cityId
            ? cityGeo.get(item.row.cityId)
            : undefined;
          return this.prisma.user.update({
            where: { id: item.id },
            data: {
              firstName: item.row.firstName,
              lastName: item.row.lastName,
              fullName: joinFullName(item.row.firstName, item.row.lastName),
              gender: item.row.gender,
              phone: item.row.phone,
              ...(item.row.nationalId
                ? { nationalId: item.row.nationalId }
                : {}),
              ...(item.row.birthDate
                ? { birthDate: parseDateOnly(item.row.birthDate) }
                : {}),
              ...(item.row.cityId
                ? {
                    cityId: item.row.cityId,
                    provinceId: geo?.provinceId ?? null,
                    countryId: geo?.countryId ?? null,
                  }
                : {}),
            },
          });
        }),
        { timeout: 180_000 },
      );
    }

    for (const idChunk of chunkArray(
      items.map((item) => item.id),
      2000,
    )) {
      await this.prisma.userRole.createMany({
        data: idChunk.map((userId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }

    return items.length;
  }

  private normalizeCityKey(value: string) {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .toLowerCase();
  }

  private async preparePilgrimImport(buffer: Buffer): Promise<ParsedPilgrimImport> {
    const parsed = await parsePilgrimImportExcel(buffer);
    if (!parsed.rows.length && parsed.invalid === 0) {
      throw new BadRequestException('فایل اکسل خالی است یا قالب آن صحیح نیست');
    }
    return this.resolvePilgrimImportCities(parsed);
  }

  private async resolvePilgrimImportCities(
    parsed: ParsedPilgrimImport,
  ): Promise<ParsedPilgrimImport> {
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
        const faKey = this.normalizeCityKey(city.nameFa);
        const enKey = this.normalizeCityKey(city.nameEn);
        if (faKey && !cityIdByKey.has(faKey)) {
          cityIdByKey.set(faKey, city.id);
        }
        if (enKey && !cityIdByKey.has(enKey)) {
          cityIdByKey.set(enKey, city.id);
        }
      }
    }

    const rows: PilgrimImportRow[] = [];
    const adjustedByRow = new Map<number, PilgrimImportIssueRow>();
    for (const item of parsed.adjustedRows) {
      adjustedByRow.set(item.rowNumber, { ...item, reasons: [...item.reasons] });
    }

    for (const row of parsed.rows) {
      if (!row.cityName) {
        rows.push({ ...row, cityId: null });
        continue;
      }
      const cityId = cityIdByKey.get(this.normalizeCityKey(row.cityName));
      if (!cityId) {
        const adjustments = [...row.adjustments, 'clearedCity'];
        rows.push({
          ...row,
          cityName: null,
          cityId: null,
          adjustments,
        });
        const existing = adjustedByRow.get(row.rowNumber);
        if (existing) {
          existing.reasons = [...existing.reasons, 'clearedCity'];
          if (!existing.city) existing.city = row.cityName;
        } else {
          adjustedByRow.set(row.rowNumber, {
            rowNumber: row.rowNumber,
            firstName: row.firstName,
            lastName: row.lastName,
            gender: row.gender,
            phone: row.phone,
            nationalId: row.nationalId ?? '',
            birthDate: row.birthDate ?? '',
            city: row.cityName,
            reasons: ['clearedCity'],
          });
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

  async findOrCreatePilgrim(dto: {
    firstName: string;
    lastName: string;
    nationalId: string;
    phone?: string | null;
    birthDate?: string | null;
    gender?: UserGender | null;
  }) {
    const nationalId = dto.nationalId.trim();
    const phone = dto.phone ? normalizePhone(dto.phone) : '';
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const birthDate = parseDateOnly(dto.birthDate);

    const byNationalId = await this.prisma.user.findUnique({
      where: { nationalId },
      include: publicInclude,
    });
    if (byNationalId) {
      await this.ensureRole(byNationalId.id, 'PILGRIM');
      const patch: Prisma.UserUpdateInput = {};
      if (birthDate && !byNationalId.birthDate) patch.birthDate = birthDate;
      if (dto.gender && !byNationalId.gender) patch.gender = dto.gender;
      if (Object.keys(patch).length) {
        await this.prisma.user.update({
          where: { id: byNationalId.id },
          data: patch,
        });
      }
      const user = await this.findOne(byNationalId.id);
      return { user, reused: true };
    }

    if (phone) {
      const byPhone = await this.prisma.user.findUnique({
        where: { phone },
        include: publicInclude,
      });
      if (byPhone) {
        await this.ensureRole(byPhone.id, 'PILGRIM');
        const patch: Prisma.UserUpdateInput = {};
        if (birthDate && !byPhone.birthDate) patch.birthDate = birthDate;
        if (dto.gender && !byPhone.gender) patch.gender = dto.gender;
        if (Object.keys(patch).length) {
          await this.prisma.user.update({
            where: { id: byPhone.id },
            data: patch,
          });
        }
        const user = await this.findOne(byPhone.id);
        return { user, reused: true };
      }
    }

    const role = await this.ensureExistingRole('PILGRIM');
    let username = nationalId;
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (usernameTaken) {
      username = `${nationalId}_${Date.now().toString(36)}`;
    }

    const passwordHash = await bcrypt.hash(nationalId, 10);
    const created = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        firstName,
        lastName,
        fullName: joinFullName(firstName, lastName),
        nationalId,
        phone: phone || null,
        gender: dto.gender ?? null,
        birthDate,
        status: UserStatus.ACTIVE,
        userRoles: { create: [{ roleId: role.id }] },
      },
      include: publicInclude,
    });

    return { user: this.toPublicUser(created), reused: false };
  }

  private async assertUniqueIdentity(
    dto: {
      username?: string;
      nationalId?: string | null;
      phone?: string | null;
      email?: string | null;
    },
    excludeId?: string,
  ) {
    const username = dto.username?.trim() || undefined;
    const nationalId = dto.nationalId?.trim() || undefined;
    const phone = dto.phone ? normalizePhone(dto.phone) || undefined : undefined;
    const email = dto.email?.trim() || undefined;
    const filters: Prisma.UserWhereInput[] = [];
    if (username) filters.push({ username });
    if (nationalId) filters.push({ nationalId });
    if (phone) filters.push({ phone });
    if (email) filters.push({ email });
    if (!filters.length) {
      return;
    }

    const matches = await this.prisma.user.findMany({
      where: {
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        OR: filters,
      },
      select: { username: true, nationalId: true, phone: true, email: true },
    });

    for (const row of matches) {
      if (nationalId && row.nationalId === nationalId) {
        throw new ConflictException('کد ملی تکراری است');
      }
      if (phone && row.phone === phone) {
        throw new ConflictException('شماره تلفن تکراری است');
      }
      if (email && row.email === email) {
        throw new ConflictException('ایمیل تکراری است');
      }
      if (username && row.username === username) {
        throw new ConflictException('نام کاربری تکراری است');
      }
    }
  }

  private async buildUsersExcel(
    items: ReturnType<UsersService['toPublicUser']>[],
  ) {
    const geoName = (item: { nameFa: string } | null | undefined) =>
      item?.nameFa ?? '';
    const genderLabel = (gender: UserGender | null) => {
      if (gender === UserGender.MALE) return 'مرد';
      if (gender === UserGender.FEMALE) return 'زن';
      return '';
    };

    return buildStyledExcelExport({
      sheetName: 'زائران',
      columns: [
        { header: 'نام و نام خانوادگی', key: 'fullName', width: 28 },
        { header: 'نام کاربری', key: 'username', width: 18 },
        { header: 'کد ملی', key: 'nationalId', width: 16 },
        { header: 'تلفن', key: 'phone', width: 16 },
        { header: 'جنسیت', key: 'gender', width: 10 },
        { header: 'کشور', key: 'country', width: 14 },
        { header: 'استان', key: 'province', width: 16 },
        { header: 'شهر', key: 'city', width: 16 },
        { header: 'آدرس', key: 'address', width: 32 },
        { header: 'توضیحات', key: 'notes', width: 32 },
      ],
      rows: items.map((item) => ({
        fullName: item.fullName,
        username: item.username,
        nationalId: item.nationalId ?? '',
        phone: item.phone ?? '',
        gender: genderLabel(item.gender),
        country: geoName(item.country),
        province: geoName(item.province),
        city: geoName(item.city),
        address: item.address ?? '',
        notes: item.notes ?? '',
      })),
    });
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const blob = `${JSON.stringify(error.meta ?? {})} ${error.message}`.toLowerCase();
      if (blob.includes('nationalid') || blob.includes('national_id')) {
        throw new ConflictException('کد ملی تکراری است');
      }
      if (blob.includes('phone')) {
        throw new ConflictException('شماره تلفن تکراری است');
      }
      if (blob.includes('email')) {
        throw new ConflictException('ایمیل تکراری است');
      }
      throw new ConflictException('نام کاربری تکراری است');
    }
    throw error;
  }
}
