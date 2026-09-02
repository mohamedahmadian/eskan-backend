import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isAdmin } from '../auth/roles.util';
import {
  normalizeNationalId,
  normalizePassportNumber,
  toLatinDigits,
} from '../common/national-id';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear, jalaliYearRange } from '../common/jalali-year';
import { normalizeMobile, normalizePhone, phoneLookupValues } from '../common/phone';
import { localeFromCountryIso2 } from '../common/request-locale';
import {
  containsInsensitive,
  normalizeSearchDigits,
  paginatedResult,
  paginationArgs,
  startsWithInsensitive,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  LocationSource,
  Prisma,
  Religion,
  ReservationStatus,
  ReservationType,
  UserGender,
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindPilgrimHistoryQueryDto } from './dto/find-pilgrim-history-query.dto';
import { type PilgrimReportExportSection } from './dto/find-pilgrim-report-query.dto';
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
import { FindLocationHistoryQueryDto } from './dto/find-location-history-query.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
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
  locationProvince: { select: { ...geoSelect, countryId: true } },
  locationCity: { select: { ...geoSelect, provinceId: true } },
  issuingOrganization: {
    select: { id: true, name: true, phone: true },
  },
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
  managedCaravans: {
    orderBy: [{ isActive: 'desc' as const }, { name: 'asc' as const }],
    select: { id: true, name: true, isActive: true },
  },
  _count: {
    select: {
      managedAccommodations: true,
      managedCaravans: true,
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
  activityStartYear: number | null;
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
  locationProvinceId: string | null;
  locationCityId: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  locationNotes: string | null;
  locationUpdatedAt: Date | null;
  issuingOrganizationId: string | null;
  photoId: string | null;
  nationalCardPhotoId: string | null;
  passportPhotoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; nameFa: string; nameEn: string } | null;
  province: { id: string; nameFa: string; nameEn: string; countryId: string } | null;
  city: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
  locationProvince: { id: string; nameFa: string; nameEn: string; countryId: string } | null;
  locationCity: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
  issuingOrganization: { id: string; name: string; phone: string | null } | null;
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
  managedCaravans: {
    id: string;
    name: string;
    isActive: boolean;
    licenseNumber?: string | null;
    totalCount?: number;
    city?: { id: string; nameFa: string; nameEn: string; provinceId: string };
    walkingRoute?: { id: string; name: string } | null;
  }[];
  _count: {
    managedAccommodations: number;
    managedCaravans: number;
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
    const [total, genderRows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['gender'],
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

    return {
      year: year ?? null,
      total,
      byGender: { male, female, unspecified },
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
    const byCountryRows = countryRows.flatMap((row) => {
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
    const byProvinceRows = provinceRows.flatMap((row) => {
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
    const byCityRows = cityRows.flatMap((row) => {
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

    const byCountry = withUnspecified(byCountryRows, unspecifiedCountry, orphanCountry);
    const byProvince = withUnspecified(byProvinceRows, unspecifiedProvince, orphanProvince);
    const byCity = withUnspecified(byCityRows, unspecifiedCity, orphanCity);

    const withEmptyYoy = (rows: { id: string; name: string; count: number }[]) =>
      rows.map((row) => ({
        ...row,
        previousCount: null,
        changePercent: null,
        changeCount: null,
      }));

    if (year == null) {
      return {
        year: null,
        byCountry: withEmptyYoy(byCountry),
        byProvince: withEmptyYoy(byProvince),
        byCity: withEmptyYoy(byCity),
      };
    }

    const prevWhere = this.pilgrimScope(year - 1);
    const [
      prevCountryRows,
      prevProvinceRows,
      prevCityRows,
      prevUnspecifiedCountry,
      prevUnspecifiedProvince,
      prevUnspecifiedCity,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['countryId'],
        where: { ...prevWhere, countryId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['provinceId'],
        where: { ...prevWhere, provinceId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['cityId'],
        where: { ...prevWhere, cityId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { ...prevWhere, countryId: null } }),
      this.prisma.user.count({ where: { ...prevWhere, provinceId: null } }),
      this.prisma.user.count({ where: { ...prevWhere, cityId: null } }),
    ]);

    const prevCountryCount = new Map(
      prevCountryRows
        .filter((row) => row.countryId)
        .map((row) => [row.countryId!, row._count._all]),
    );
    const prevProvinceCount = new Map(
      prevProvinceRows
        .filter((row) => row.provinceId)
        .map((row) => [row.provinceId!, row._count._all]),
    );
    const prevCityCount = new Map(
      prevCityRows
        .filter((row) => row.cityId)
        .map((row) => [row.cityId!, row._count._all]),
    );

    const attachYoy = (
      rows: { id: string; name: string; count: number }[],
      previous: Map<string, number>,
      previousUnspecified: number,
    ) =>
      rows.map((row) => {
        const previousCount =
          row.id === unspecifiedId
            ? previousUnspecified
            : (previous.get(row.id) ?? 0);
        const changeCount = row.count - previousCount;
        const changePercent =
          previousCount === 0
            ? null
            : Math.round(((row.count - previousCount) / previousCount) * 100);
        return { ...row, previousCount, changePercent, changeCount };
      });

    return {
      year,
      byCountry: attachYoy(byCountry, prevCountryCount, prevUnspecifiedCountry),
      byProvince: attachYoy(byProvince, prevProvinceCount, prevUnspecifiedProvince),
      byCity: attachYoy(byCity, prevCityCount, prevUnspecifiedCity),
    };
  }

  async pilgrimReportTimeline(year?: number) {
    const pilgrimRole: Prisma.UserWhereInput = {
      userRoles: { some: { role: { code: 'PILGRIM' } } },
    };

    const emptyYear: {
      year: number;
      count: number;
      changePercent: number | null;
      changeCount: number | null;
    }[] = [];

    const bounds = await this.prisma.user.aggregate({
      where: pilgrimRole,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    if (!bounds._min.createdAt || !bounds._max.createdAt) {
      return {
        year: year ?? null,
        byYear: emptyYear,
      };
    }

    const fromYear = currentJalaliYear(bounds._min.createdAt);
    const toYear = currentJalaliYear(bounds._max.createdAt);
    const yearCounts = await Promise.all(
      Array.from({ length: Math.max(0, toYear - fromYear + 1) }, async (_, index) => {
        const jalaliYear = fromYear + index;
        const { gte, lt } = jalaliYearRange(jalaliYear);
        const count = await this.prisma.user.count({
          where: { ...pilgrimRole, createdAt: { gte, lt } },
        });
        return { year: jalaliYear, count };
      }),
    );

    const byYear = yearCounts
      .filter((row) => row.count > 0)
      .map((row) => {
        const previous = yearCounts.find((item) => item.year === row.year - 1);
        const prevCount = previous?.count ?? 0;
        const changeCount = previous == null ? null : row.count - prevCount;
        const changePercent =
          previous == null || prevCount === 0
            ? null
            : Math.round(((row.count - prevCount) / prevCount) * 100);
        return { ...row, changePercent, changeCount };
      });

    return {
      year: year ?? null,
      byYear,
    };
  }

  private pilgrimProvinceScope(provinceId: string): Prisma.UserWhereInput {
    const unspecifiedId = '__unspecified__';
    return {
      userRoles: { some: { role: { code: 'PILGRIM' } } },
      provinceId: provinceId === unspecifiedId ? null : provinceId,
    };
  }

  private pilgrimCityScope(cityId: string): Prisma.UserWhereInput {
    const unspecifiedId = '__unspecified__';
    return {
      userRoles: { some: { role: { code: 'PILGRIM' } } },
      cityId: cityId === unspecifiedId ? null : cityId,
    };
  }

  private async yearlyGrowthRows(where: Prisma.UserWhereInput) {
    const emptyYear: {
      year: number;
      count: number;
      changePercent: number | null;
      changeCount: number | null;
    }[] = [];

    const bounds = await this.prisma.user.aggregate({
      where,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    if (!bounds._min.createdAt || !bounds._max.createdAt) {
      return emptyYear;
    }

    const fromYear = currentJalaliYear(bounds._min.createdAt);
    const toYear = currentJalaliYear(bounds._max.createdAt);
    const yearCounts = await Promise.all(
      Array.from({ length: Math.max(0, toYear - fromYear + 1) }, async (_, index) => {
        const jalaliYear = fromYear + index;
        const { gte, lt } = jalaliYearRange(jalaliYear);
        const count = await this.prisma.user.count({
          where: { ...where, createdAt: { gte, lt } },
        });
        return { year: jalaliYear, count };
      }),
    );

    return yearCounts
      .filter((row) => row.count > 0)
      .map((row) => {
        const previous = yearCounts.find((item) => item.year === row.year - 1);
        const prevCount = previous?.count ?? 0;
        const changeCount = previous == null ? null : row.count - prevCount;
        const changePercent =
          previous == null || prevCount === 0
            ? null
            : Math.round(((row.count - prevCount) / prevCount) * 100);
        return { ...row, changePercent, changeCount };
      });
  }

  async pilgrimReportProvinceTimeline(provinceId: string) {
    const unspecifiedId = '__unspecified__';
    const where = this.pilgrimProvinceScope(provinceId);

    let provinceName = 'نامشخص';
    if (provinceId !== unspecifiedId) {
      const province = await this.prisma.province.findUnique({
        where: { id: provinceId },
        select: { id: true, nameFa: true },
      });
      if (!province) {
        throw new NotFoundException('استان یافت نشد');
      }
      provinceName = province.nameFa;
    }

    return {
      provinceId,
      provinceName,
      byYear: await this.yearlyGrowthRows(where),
    };
  }

  async exportPilgrimReportProvinceTimeline(provinceId: string) {
    const report = await this.pilgrimReportProvinceTimeline(provinceId);
    const buffer = await this.exportYearlyGrowthExcel(
      report.provinceName.slice(0, 31) || 'استان',
      report.byYear,
    );
    return {
      buffer,
      filename: 'pilgrims-report-province-years.xlsx',
      provinceName: report.provinceName,
    };
  }

  async pilgrimReportCityTimeline(cityId: string) {
    const unspecifiedId = '__unspecified__';
    const where = this.pilgrimCityScope(cityId);

    let cityName = 'نامشخص';
    if (cityId !== unspecifiedId) {
      const city = await this.prisma.city.findUnique({
        where: { id: cityId },
        select: { id: true, nameFa: true },
      });
      if (!city) {
        throw new NotFoundException('شهر یافت نشد');
      }
      cityName = city.nameFa;
    }

    return {
      cityId,
      cityName,
      byYear: await this.yearlyGrowthRows(where),
    };
  }

  async exportPilgrimReportCityTimeline(cityId: string) {
    const report = await this.pilgrimReportCityTimeline(cityId);
    const buffer = await this.exportYearlyGrowthExcel(
      report.cityName.slice(0, 31) || 'شهر',
      report.byYear,
    );
    return {
      buffer,
      filename: 'pilgrims-report-city-years.xlsx',
      cityName: report.cityName,
    };
  }

  private exportYearlyGrowthExcel(
    sheetName: string,
    rows: {
      year: number;
      count: number;
      changePercent: number | null;
      changeCount: number | null;
    }[],
  ) {
    return buildStyledExcelExport({
      sheetName,
      columns: [
        { header: 'سال', key: 'year', width: 12 },
        { header: 'تعداد زائر', key: 'count', width: 16 },
        { header: 'درصد رشد', key: 'changePercent', width: 14 },
        { header: 'تغییر تعداد', key: 'changeCount', width: 14 },
      ],
      rows: rows.map((row) => ({
        year: row.year,
        count: row.count,
        changePercent: row.changePercent ?? '',
        changeCount: row.changeCount ?? '',
      })),
    });
  }

  async pilgrimReport(year?: number) {
    const [summary, geo, timeline] = await Promise.all([
      this.pilgrimReportSummary(year),
      this.pilgrimReportGeo(year),
      this.pilgrimReportTimeline(year),
    ]);

    return {
      ...summary,
      ...geo,
      byYear: timeline.byYear,
    };
  }

  async exportPilgrimReport(section: PilgrimReportExportSection, year?: number) {
    const unspecifiedId = '__unspecified__';
    const geoLabel = (id: string, name: string) =>
      id === unspecifiedId ? 'نامشخص' : name;
    const sharePercent = (count: number, total: number) =>
      total <= 0 ? 0 : Math.round((count / total) * 100);

    if (section === 'year') {
      const timeline = await this.pilgrimReportTimeline(year);
      const buffer = await buildStyledExcelExport({
        sheetName: 'سال',
        columns: [
          { header: 'سال', key: 'year', width: 12 },
          { header: 'تعداد زائر', key: 'count', width: 16 },
          { header: 'درصد رشد', key: 'changePercent', width: 14 },
          { header: 'تغییر تعداد', key: 'changeCount', width: 14 },
        ],
        rows: timeline.byYear.map((row) => ({
          year: row.year,
          count: row.count,
          changePercent: row.changePercent ?? '',
          changeCount: row.changeCount ?? '',
        })),
      });
      return { buffer, filename: 'pilgrims-report-year.xlsx' };
    }

    const [summary, geo] = await Promise.all([
      this.pilgrimReportSummary(year),
      this.pilgrimReportGeo(year),
    ]);
    const geoRows =
      section === 'country'
        ? geo.byCountry
        : section === 'province'
          ? geo.byProvince
          : geo.byCity;
    const sheetName =
      section === 'country' ? 'کشور' : section === 'province' ? 'استان' : 'شهر';
    const nameHeader =
      section === 'country' ? 'عنوان' : section === 'province' ? 'استان' : 'شهر';
    const withYear = year != null;
    const withYoy = withYear && section !== 'country';
    const buffer = await buildStyledExcelExport({
      sheetName,
      columns: [
        { header: nameHeader, key: 'name', width: 24 },
        {
          header: withYear ? `تعداد سال ${year}` : 'تعداد زائر',
          key: 'count',
          width: 16,
        },
        ...(withYear
          ? [
              {
                header: `تعداد سال ${year - 1}`,
                key: 'previousCount',
                width: 16,
              },
            ]
          : []),
        { header: 'درصد', key: 'percent', width: 12 },
        ...(withYoy
          ? [
              { header: 'درصد رشد نسبت به سال قبل', key: 'changePercent', width: 22 },
              { header: 'تغییر تعداد نسبت به سال قبل', key: 'changeCount', width: 24 },
            ]
          : []),
      ],
      rows: geoRows.map((row) => ({
        name: geoLabel(row.id, row.name),
        count: row.count,
        ...(withYear ? { previousCount: row.previousCount ?? 0 } : {}),
        percent: sharePercent(row.count, summary.total),
        ...(withYoy
          ? {
              changePercent: row.changePercent ?? '',
              changeCount: row.changeCount ?? '',
            }
          : {}),
      })),
    });
    return { buffer, filename: `pilgrims-report-${section}.xlsx` };
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
        caravanCount: (dir) => ({
          managedCaravans: { _count: dir },
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
        managedCaravans: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            isActive: true,
            licenseNumber: true,
            totalCount: true,
            city: {
              select: {
                id: true,
                nameFa: true,
                nameEn: true,
                provinceId: true,
              },
            },
            walkingRoute: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return this.toPublicUser(user, true);
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, status: UserStatus.ACTIVE },
      include: {
        userRoles: { include: { role: { select: roleSelect } } },
        country: { select: geoSelect },
        province: { select: { ...geoSelect, countryId: true } },
        city: { select: { ...geoSelect, provinceId: true } },
        managedAccommodations: {
          orderBy: [{ year: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            accommodation: {
              select: { id: true, name: true, type: true, status: true },
            },
          },
        },
        managedCaravans: {
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            isActive: true,
            licenseNumber: true,
            totalCount: true,
            city: {
              select: {
                id: true,
                nameFa: true,
                nameEn: true,
                provinceId: true,
              },
            },
            walkingRoute: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const roles = user.userRoles.map((item) => item.role);
    const roleCodes = new Set(roles.map((role) => role.code));
    const isCaravanManager = roleCodes.has('CARAVAN_MANAGER');
    const isAccommodationManager = roleCodes.has('ACCOMMODATION_MANAGER');
    const isPilgrimUser = roleCodes.has('PILGRIM');
    const pilgrimages =
      isCaravanManager || isPilgrimUser
        ? await this.findPublicPilgrimages(user.id)
        : [];

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      gender: user.gender,
      nationalId: user.nationalId,
      phone: user.phone,
      photoId: user.photoId,
      activityStartYear: user.activityStartYear,
      country: user.country,
      province: user.province,
      city: user.city,
      roles,
      caravans: isCaravanManager ? user.managedCaravans : [],
      accommodations: isAccommodationManager
        ? user.managedAccommodations.map((item) => ({
            id: item.id,
            year: item.year,
            isPrimary: item.isPrimary,
            accommodation: item.accommodation,
          }))
        : [],
      pilgrimages,
    };
  }

  private async findPublicPilgrimages(userId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          {
            createdById: userId,
            type: { in: [ReservationType.INDIVIDUAL, ReservationType.GROUP] },
          },
        ],
      },
      orderBy: [{ year: 'desc' }, { stayStartDate: 'desc' }, { createdAt: 'desc' }],
      take: 40,
      select: {
        id: true,
        year: true,
        type: true,
        status: true,
        stayStartDate: true,
        stayEndDate: true,
        walkingStartDate: true,
        originCity: {
          select: { id: true, nameFa: true, nameEn: true, provinceId: true },
        },
        walkingRoute: { select: { id: true, name: true } },
        caravan: { select: { id: true, name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      year: row.year,
      type: row.type,
      status: row.status,
      stayStartDate: toDateOnly(row.stayStartDate),
      stayEndDate: toDateOnly(row.stayEndDate),
      walkingStartDate: toDateOnly(row.walkingStartDate),
      originCity: row.originCity,
      walkingRoute: row.walkingRoute,
      caravan: row.caravan,
    }));
  }

  async create(dto: CreateUserDto) {
    const roleIds = await this.assertRolesExist(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const geo = await this.resolveGeo(dto);
    await this.assertImages(dto);
    await this.assertUniqueIdentity(dto);
    await this.assertLicenseIssuerOrganization(roleIds, dto.issuingOrganizationId);

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
    const nextRoleIds = dto.roleIds ?? current.roles.map((role) => role.id);
    const nextOrganizationId =
      dto.issuingOrganizationId === undefined
        ? current.issuingOrganizationId
        : dto.issuingOrganizationId;
    await this.assertLicenseIssuerOrganization(nextRoleIds, nextOrganizationId);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (dto.roleIds) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }

        const stillOfficer = dto.roleIds
          ? (
              await tx.role.findMany({
                where: { id: { in: dto.roleIds } },
                select: { code: true },
              })
            ).some((role) => role.code === 'GOVERNMENT_ORG_OFFICER')
          : current.roles.some((role) => role.code === 'GOVERNMENT_ORG_OFFICER');
        await this.syncGovernmentOrgContact(
          tx,
          id,
          stillOfficer,
          nextOrganizationId,
        );

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

  /** Self-service profile edit: roles, status, and password cannot change here. */
  async updateOwnAccount(id: string, dto: UpdateUserDto) {
    const {
      roleIds: _roleIds,
      status: _status,
      password: _password,
      ...safe
    } = dto;
    const current = await this.findOne(id);
    const countryId =
      safe.countryId === undefined ? current.countryId : safe.countryId;
    const iran = await this.prisma.country.findFirst({
      where: { iso2: 'IR' },
      select: { id: true },
    });
    const isIranian = Boolean(iran && countryId === iran.id);
    const nextPhone =
      safe.phone === undefined ? current.phone : safe.phone;
    if (isIranian) {
      const phone = nextPhone ? normalizeMobile(nextPhone) : '';
      if (!/^09\d{9}$/.test(phone)) {
        throw new BadRequestException('شماره همراه معتبر نیست');
      }
      safe.phone = phone;
    } else if (safe.phone) {
      if (safe.phone.length < 8) {
        throw new BadRequestException('شماره همراه معتبر نیست');
      }
    }
    if (safe.email && !safe.email.includes('@')) {
      throw new BadRequestException('ایمیل معتبر نیست');
    }
    return this.update(id, safe);
  }

  async updateLocation(id: string, dto: UpdateUserLocationDto) {
    await this.findOne(id);
    if (
      (dto.latitude == null && dto.longitude != null) ||
      (dto.latitude != null && dto.longitude == null)
    ) {
      throw new BadRequestException('عرض و طول جغرافیایی باید با هم ثبت شوند');
    }
    const station = dto.walkingStationId
      ? await this.prisma.walkingStation.findUnique({
          where: { id: dto.walkingStationId },
          include: { city: true },
        })
      : null;
    if (dto.walkingStationId && !station) {
      throw new BadRequestException('ایستگاه انتخاب‌شده معتبر نیست');
    }
    const geo = await this.resolveLocationGeo({
      provinceId: dto.provinceId ?? station?.city.provinceId ?? null,
      cityId: dto.cityId ?? station?.cityId ?? null,
    });
    const notes = dto.notes?.trim() ? dto.notes.trim() : null;
    const source =
      dto.source ?? (station ? LocationSource.STATION : LocationSource.MANUAL);
    let latitude =
      dto.latitude == null ? null : new Prisma.Decimal(dto.latitude);
    let longitude =
      dto.longitude == null ? null : new Prisma.Decimal(dto.longitude);
    if (latitude == null && longitude == null && station) {
      const stationLat = station.latitude ?? station.city.latitude;
      const stationLng = station.longitude ?? station.city.longitude;
      if (stationLat != null && stationLng != null) {
        latitude = new Prisma.Decimal(stationLat);
        longitude = new Prisma.Decimal(stationLng);
      }
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          locationProvinceId: geo.provinceId,
          locationCityId: geo.cityId,
          latitude,
          longitude,
          locationNotes: source === LocationSource.APP ? undefined : notes,
          locationUpdatedAt: new Date(),
        },
        include: publicInclude,
      });
      await tx.userLocationHistory.create({
        data: {
          userId: id,
          provinceId: geo.provinceId,
          cityId: geo.cityId,
          latitude,
          longitude,
          notes,
          source,
        },
      });
      const reservation = await this.resolveTravelReservation(
        tx,
        id,
        dto.reservationId,
      );
      if (reservation && source !== LocationSource.APP) {
        await tx.reservationTravelHistory.create({
          data: {
            reservationId: reservation.id,
            userId: id,
            walkingStationId: station?.id ?? null,
            provinceId: geo.provinceId,
            cityId: geo.cityId,
            latitude,
            longitude,
            notes,
          },
        });
      }
      return updated;
    });
    return this.toPublicUser(user);
  }

  async findLocationHistory(userId: string, query: FindLocationHistoryQueryDto) {
    await this.findOne(userId);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const q = query.q?.trim();
    const where: Prisma.UserLocationHistoryWhereInput = {
      userId,
      ...(query.source ? { source: query.source } : {}),
      ...(q
        ? {
            OR: [
              { notes: containsInsensitive(q) },
              { province: { nameFa: containsInsensitive(q) } },
              { province: { nameEn: containsInsensitive(q) } },
              { city: { nameFa: containsInsensitive(q) } },
              { city: { nameEn: containsInsensitive(q) } },
            ],
          }
        : {}),
    };
    const orderBy =
      resolveSortOrder<Prisma.UserLocationHistoryOrderByWithRelationInput>(
        query.sortBy === 'seq' ? 'createdAt' : query.sortBy,
        query.sortDir,
        {
          createdAt: (dir) => ({ createdAt: dir }),
          province: (dir) => ({ province: { nameFa: dir } }),
          city: (dir) => ({ city: { nameFa: dir } }),
          notes: (dir) => ({ notes: dir }),
          source: (dir) => ({ source: dir }),
        },
        [{ createdAt: 'desc' }, { id: 'desc' }],
      );
    const include = {
      province: { select: { ...geoSelect, countryId: true } },
      city: { select: { ...geoSelect, provinceId: true } },
    } as const;
    const [items, total, ranked, filteredMap] = await Promise.all([
      this.prisma.userLocationHistory.findMany({
        where,
        skip,
        take,
        orderBy,
        include,
      }),
      this.prisma.userLocationHistory.count({ where }),
      this.prisma.userLocationHistory.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include,
      }),
      this.prisma.userLocationHistory.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include,
      }),
    ]);
    const seqById = new Map(ranked.map((item, index) => [item.id, index + 1]));
    const mapPoints = filteredMap
      .filter(
        (item) =>
          item.latitude != null &&
          item.longitude != null &&
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      )
      .map((item) =>
        this.serializeLocationHistory(item, seqById.get(item.id) ?? 0),
      );
    return {
      ...paginatedResult(
        items.map((item) =>
          this.serializeLocationHistory(item, seqById.get(item.id) ?? 0),
        ),
        total,
        page,
        pageSize,
      ),
      mapPoints,
    };
  }

  async removeLocationHistory(userId: string, historyId: string) {
    await this.findOne(userId);
    const item = await this.prisma.userLocationHistory.findFirst({
      where: { id: historyId, userId },
    });
    if (!item) {
      throw new NotFoundException('ردپای مکانی یافت نشد');
    }
    const latest = await this.prisma.userLocationHistory.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationHistory.delete({ where: { id: historyId } });
      if (latest?.id === historyId) {
        await this.syncUserCurrentLocationFromHistory(tx, userId);
      }
    });
    return { ok: true };
  }

  async removeAllLocationHistory(userId: string) {
    await this.findOne(userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.userLocationHistory.deleteMany({
        where: { userId },
      });
      await this.clearUserCurrentLocation(tx, userId);
      return deleted;
    });
    return { ok: true, deleted: result.count };
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

  async removeRole(userId: string, roleCode: string, _actorId: string) {
    const current = await this.findOne(userId);
    const remainingIds = current.roles
      .filter((role) => role.code !== roleCode)
      .map((role) => role.id);

    if (remainingIds.length === current.roles.length) {
      return this.findOne(userId);
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
      if (roleCode === 'UNIT_MANAGER') {
        await tx.orgUnit.updateMany({
          where: { managerUserId: userId },
          data: { managerUserId: null },
        });
      }
      if (roleCode === 'GOVERNMENT_ORG_OFFICER') {
        await tx.governmentOrganization.updateMany({
          where: { contactUserId: userId },
          data: { contactUserId: null },
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

  async findPilgrimageHistory(id: string, query: FindPilgrimHistoryQueryDto) {
    await this.assertHasRole(id, 'PILGRIM', 'زائر یافت نشد');
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where: Prisma.ReservationWhereInput = {
      OR: [
        { members: { some: { userId: id } } },
        {
          createdById: id,
          type: { in: [ReservationType.INDIVIDUAL, ReservationType.GROUP] },
        },
      ],
    };
    const orderBy = resolveSortOrder<Prisma.ReservationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        year: (dir) => ({ year: dir }),
        type: (dir) => ({ type: dir }),
        status: (dir) => ({ status: dir }),
        stayStartDate: (dir) => ({ stayStartDate: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
        caravan: (dir) => ({ caravan: { name: dir } }),
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
          caravan: {
            select: {
              id: true,
              name: true,
              officePhone: true,
              foundedYear: true,
              licenseNumber: true,
              isActive: true,
              maleCount: true,
              femaleCount: true,
              totalCount: true,
              city: { select: geoSelect },
              manager: { select: personSelect },
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              maleCount: true,
              femaleCount: true,
              totalCount: true,
              city: { select: geoSelect },
              manager: { select: personSelect },
            },
          },
          caravanManager: { select: personSelect },
          createdBy: { select: personSelect },
          members: {
            where: { userId: id },
            select: { insuranceStatus: true },
          },
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
        hasPermit: row.hasPermit,
        permitStatus: row.permitStatus,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        insuranceStatus: row.members[0]?.insuranceStatus ?? null,
        isMember: row.members.length > 0,
        caravan: row.caravan,
        group: row.group,
        caravanManager: row.caravanManager,
        createdBy: row.createdBy,
      })),
      total,
      page,
      pageSize,
    );
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

  /** تعیین رمز توسط ادمین و پیامک همان رمز برای هر کاربر */
  async setUserPasswordAndSms(
    id: string,
    dto: { password: string },
    actorId: string,
  ) {
    const user = await this.findOne(id);
    if (!user.phone) {
      throw new BadRequestException('شماره همراه برای ارسال پیامک ثبت نشده است');
    }

    await this.sms.assertConfigured();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    const isPilgrim = user.roles.some((role) => role.code === 'PILGRIM');
    await this.sms.send({
      phone: user.phone,
      body: [
        isPilgrim ? `زائر گرامی ${user.fullName}` : `${user.fullName} گرامی`,
        'رمز عبور جدید سامانه اسکان:',
        dto.password,
        'ورود با کد ملی یا شماره همراه',
      ].join('\n'),
      sentById: actorId,
    });

    return { ok: true };
  }

  async recoverOwnPilgrimPassword(userId: string) {
    return this.resetUserPasswordAndSms(userId, userId);
  }

  /** بازیابی عمومی: کاربر کانال پیامک یا ایمیل را انتخاب می‌کند. */
  async forgotPasswordByIdentifier(
    identifier: string,
    channel: 'sms' | 'email',
  ) {
    const user = await this.findActiveByIdentifier(identifier);
    if (!user) {
      return { status: 'not_found' as const };
    }
    if (channel === 'email') {
      return { status: 'no_email' as const };
    }
    if (!user.phone?.trim()) {
      return { status: 'no_phone' as const };
    }
    await this.resetUserPasswordAndSms(user.id, user.id);
    return { status: 'sent' as const };
  }

  /** ثبت‌نام عمومی حساب؛ بدون نقش دامنه. */
  async selfRegister(dto: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    locale?: string;
    countryId?: string;
    gender?: UserGender | null;
    phone?: string;
    passportNumber?: string;
    email?: string;
  }) {
    const username = toLatinDigits(dto.username.trim());
    if (username.length < 3) {
      throw new BadRequestException('نام کاربری باید حداقل ۳ کاراکتر باشد');
    }
    if (toLatinDigits(dto.password).length < 8) {
      throw new BadRequestException('رمز عبور باید حداقل ۸ کاراکتر باشد');
    }

    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(username)) {
      throw new BadRequestException('نام کاربری باید با حروف انگلیسی باشد');
    }

    const iran = await this.prisma.country.findFirst({
      where: { iso2: 'IR' },
      select: { id: true },
    });
    const countryId = dto.countryId ?? iran?.id ?? null;
    let countryIso2: string | null = null;
    if (countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: countryId },
        select: { id: true, iso2: true, isActive: true },
      });
      if (!country || !country.isActive) {
        throw new BadRequestException('کشور انتخاب‌شده معتبر نیست');
      }
      countryIso2 = country.iso2;
    }
    const locale = localeFromCountryIso2(countryIso2);
    const isIranian = Boolean(iran && countryId === iran.id);

    let nationalId: string | null = null;
    let phone: string | null = null;
    let email: string | null = null;

    if (dto.phone?.trim()) {
      phone = isIranian ? normalizeMobile(dto.phone) : normalizePhone(dto.phone);
      if (isIranian && !/^09\d{9}$/.test(phone)) {
        throw new BadRequestException('شماره همراه معتبر نیست');
      }
      if (!isIranian && phone.length < 8) {
        throw new BadRequestException('شماره همراه معتبر نیست');
      }
    } else if (isIranian) {
      throw new BadRequestException('شماره همراه معتبر نیست');
    }

    if (!isIranian) {
      const passport = normalizePassportNumber(dto.passportNumber ?? '');
      if (passport) {
        if (passport.length < 5) {
          throw new BadRequestException('شماره گذرنامه معتبر نیست');
        }
        nationalId = passport;
      }

      email = dto.email?.trim().toLowerCase() || null;
      if (email && !email.includes('@')) {
        throw new BadRequestException('ایمیل معتبر نیست');
      }
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    await this.assertUniqueIdentity({
      username,
      nationalId,
      phone,
      email,
    });

    const passwordHash = await bcrypt.hash(toLatinDigits(dto.password), 10);

    await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        firstName,
        lastName,
        fullName: joinFullName(firstName, lastName),
        locale,
        nationalId,
        phone,
        email,
        gender: dto.gender ?? UserGender.MALE,
        countryId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    return { status: 'registered' as const, locale };
  }

  private async findActiveByIdentifier(identifier: string) {
    const raw = toLatinDigits(identifier.trim());
    if (!raw) {
      return null;
    }
    const nationalId = normalizeNationalId(raw);
    const passport = normalizePassportNumber(raw);
    const phones = phoneLookupValues(raw);
    const email = raw.includes('@') ? raw.toLowerCase() : '';
    const or: Prisma.UserWhereInput[] = [{ username: raw }];
    if (nationalId) {
      or.push({ nationalId });
    }
    if (passport && passport !== nationalId) {
      or.push({ nationalId: passport });
    }
    for (const phone of phones) {
      or.push({ phone });
    }
    if (email) {
      or.push({ email });
    }
    return this.prisma.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        OR: or,
      },
      select: { id: true, phone: true },
    });
  }

  /** تعریف رمز الگوی تکراری (مثل ۲۲۵۵۶۶۴۴) و پیامک — توسط ادمین یا خود کاربر */
  async resetUserPasswordAndSms(id: string, actorId: string) {
    const user = await this.findOne(id);
    if (!user.phone) {
      throw new BadRequestException('شماره همراه برای ارسال پیامک ثبت نشده است');
    }

    await this.sms.assertConfigured();
    const password = resolvePilgrimResetPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    const isPilgrim = user.roles.some((role) => role.code === 'PILGRIM');
    await this.sms.send({
      phone: user.phone,
      body: [
        isPilgrim ? `زائر گرامی ${user.fullName}` : `${user.fullName} گرامی`,
        'رمز عبور جدید سامانه اسکان:',
        password,
        'ورود با کد ملی یا شماره همراه',
      ].join('\n'),
      sentById: actorId,
    });

    return { ok: true };
  }

  /** برای مسیر زائران: فقط اگر نقش PILGRIM داشته باشد */
  async resetPilgrimPasswordAndSms(id: string, actorId: string) {
    await this.assertHasRole(id, 'PILGRIM', 'زائر یافت نشد');
    return this.resetUserPasswordAndSms(id, actorId);
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
      { issuingOrganization: { name: text } },
      { managedCaravans: { some: { name: text } } },
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
    set('activityStartYear', dto.activityStartYear);
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
    set('issuingOrganizationId', dto.issuingOrganizationId);
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
      activityStartYear: user.activityStartYear,
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
      locationProvinceId: user.locationProvinceId,
      locationCityId: user.locationCityId,
      latitude: user.latitude == null ? null : Number(user.latitude),
      longitude: user.longitude == null ? null : Number(user.longitude),
      locationNotes: user.locationNotes,
      locationUpdatedAt: user.locationUpdatedAt,
      issuingOrganizationId: user.issuingOrganizationId,
      country: user.country,
      province: user.province,
      city: user.city,
      locationProvince: user.locationProvince,
      locationCity: user.locationCity,
      issuingOrganization: user.issuingOrganization,
      photoId: user.photoId,
      nationalCardPhotoId: user.nationalCardPhotoId,
      passportPhotoId: user.passportPhotoId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((item) => item.role),
      accommodationCount: user._count.managedAccommodations,
      caravanCount: user._count.managedCaravans,
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
      caravans: user.managedCaravans?.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
        licenseNumber: item.licenseNumber,
        totalCount: item.totalCount,
        city: item.city,
        walkingRoute: item.walkingRoute,
      })),
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

  private async syncUserCurrentLocationFromHistory(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const latest = await tx.userLocationHistory.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!latest) {
      await this.clearUserCurrentLocation(tx, userId);
      return;
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        locationProvinceId: latest.provinceId,
        locationCityId: latest.cityId,
        latitude: latest.latitude,
        longitude: latest.longitude,
        locationNotes:
          latest.source === LocationSource.APP ? undefined : latest.notes,
        locationUpdatedAt: latest.createdAt,
      },
    });
  }

  private async clearUserCurrentLocation(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await tx.user.update({
      where: { id: userId },
      data: {
        locationProvinceId: null,
        locationCityId: null,
        latitude: null,
        longitude: null,
        locationNotes: null,
        locationUpdatedAt: null,
      },
    });
  }

  private serializeLocationHistory(
    item: {
      id: string;
      provinceId: string | null;
      cityId: string | null;
      latitude: Prisma.Decimal | null;
      longitude: Prisma.Decimal | null;
      notes: string | null;
      source: LocationSource;
      createdAt: Date;
      province: {
        id: string;
        nameFa: string;
        nameEn: string;
        countryId: string;
      } | null;
      city: {
        id: string;
        nameFa: string;
        nameEn: string;
        provinceId: string;
      } | null;
    },
    seq: number,
  ) {
    return {
      id: item.id,
      seq,
      provinceId: item.provinceId,
      cityId: item.cityId,
      latitude: item.latitude == null ? null : Number(item.latitude),
      longitude: item.longitude == null ? null : Number(item.longitude),
      notes: item.notes,
      source: item.source,
      createdAt: item.createdAt,
      province: item.province,
      city: item.city,
    };
  }

  private async resolveTravelReservation(
    tx: Prisma.TransactionClient,
    userId: string,
    reservationId?: string | null,
  ) {
    if (reservationId) {
      const row = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { members: { select: { userId: true } } },
      });
      if (!row) return null;
      const allowed =
        row.createdById === userId ||
        row.caravanManagerId === userId ||
        row.members.some((item) => item.userId === userId);
      return allowed ? row : null;
    }
    return tx.reservation.findFirst({
      where: {
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED],
        },
        OR: [
          {
            createdById: userId,
            type: { in: [ReservationType.INDIVIDUAL, ReservationType.GROUP] },
          },
          { members: { some: { userId } } },
          { caravanManagerId: userId },
          { createdById: userId, type: ReservationType.CARAVAN },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  private async resolveLocationGeo(dto: {
    provinceId?: string | null;
    cityId?: string | null;
  }) {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) {
        throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
      }
      if (dto.provinceId && dto.provinceId !== city.provinceId) {
        throw new BadRequestException('شهر با استان انتخاب‌شده هم‌خوان نیست');
      }
      return { cityId: city.id, provinceId: city.provinceId };
    }
    if (dto.provinceId) {
      const province = await this.prisma.province.findUnique({
        where: { id: dto.provinceId },
      });
      if (!province) {
        throw new BadRequestException('استان انتخاب‌شده معتبر نیست');
      }
      return { cityId: null, provinceId: province.id };
    }
    return { cityId: null, provinceId: null };
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

  private async syncGovernmentOrgContact(
    tx: Prisma.TransactionClient,
    userId: string,
    stillOfficer: boolean,
    nextOrganizationId: string | null,
  ) {
    if (!stillOfficer) {
      await tx.governmentOrganization.updateMany({
        where: { contactUserId: userId },
        data: { contactUserId: null },
      });
      return;
    }
    await tx.governmentOrganization.updateMany({
      where: {
        contactUserId: userId,
        ...(nextOrganizationId ? { id: { not: nextOrganizationId } } : {}),
      },
      data: { contactUserId: null },
    });
  }

  private async assertLicenseIssuerOrganization(
    roleIds: string[],
    organizationId?: string | null,
  ) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { code: true },
    });
    const needsOrganization = roles.some(
      (role) =>
        role.code === 'LICENSE_ISSUER' ||
        role.code === 'GOVERNMENT_ORG_OFFICER',
    );
    if (needsOrganization && !organizationId) {
      throw new BadRequestException('سازمان مربوطه را انتخاب کنید');
    }
    if (!organizationId) {
      return;
    }
    const organization = await this.prisma.governmentOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new BadRequestException('سازمان انتخاب‌شده معتبر نیست');
    }
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
    username?: string;
    email?: string;
    passportNumber?: string;
    excludeId?: string;
  }) {
    const nationalId = dto.nationalId?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    const username = dto.username?.trim() || undefined;
    const email = dto.email?.trim().toLowerCase() || undefined;
    const passportNumber = dto.passportNumber?.trim() || undefined;
    if (!nationalId && !phone && !username && !email && !passportNumber) {
      throw new BadRequestException('کد ملی، شماره تلفن یا نام کاربری لازم است');
    }

    const exclude = dto.excludeId ? { NOT: { id: dto.excludeId } } : {};
    const [nationalIdHit, passportHit, phoneHit, usernameHit, emailHit] =
      await Promise.all([
        nationalId
          ? this.prisma.user.findFirst({
              where: { nationalId, ...exclude },
              select: { id: true, fullName: true },
            })
          : Promise.resolve(null),
        passportNumber
          ? this.prisma.user.findFirst({
              where: { nationalId: passportNumber, ...exclude },
              select: { id: true },
            })
          : Promise.resolve(null),
        phone
          ? this.prisma.user.findFirst({
              where: { phone, ...exclude },
              select: { id: true },
            })
          : Promise.resolve(null),
        username
          ? this.prisma.user.findFirst({
              where: { username, ...exclude },
              select: { id: true },
            })
          : Promise.resolve(null),
        email
          ? this.prisma.user.findFirst({
              where: { email, ...exclude },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

    return {
      taken: Boolean(
        nationalIdHit || passportHit || phoneHit || usernameHit || emailHit,
      ),
      nationalIdTaken: Boolean(nationalIdHit),
      nationalIdOwnerName: nationalIdHit?.fullName?.trim() || null,
      phoneTaken: Boolean(phoneHit),
      usernameTaken: Boolean(usernameHit),
      emailTaken: Boolean(emailHit),
      passportTaken: Boolean(passportHit),
    };
  }

  async checkRegisterIdentityTaken(dto: {
    phone?: string;
    email?: string;
    passportNumber?: string;
  }) {
    if (!dto.phone && !dto.email && !dto.passportNumber) {
      return {
        phoneTaken: false,
        emailTaken: false,
        passportTaken: false,
      };
    }
    const result = await this.checkIdentityTaken(dto);
    return {
      phoneTaken: result.phoneTaken,
      emailTaken: result.emailTaken,
      passportTaken: result.passportTaken,
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
    return toLatinDigits(value)
      .replace(/\u200c/g, '')
      .replace(/[()]/g, '')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();
  }

  private cityLookupKeys(nameFa: string, nameEn: string) {
    const keys = [this.normalizeCityKey(nameFa), this.normalizeCityKey(nameEn)];
    const fa = toLatinDigits(nameFa)
      .replace(/\u200c/g, '')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\s+/g, ' ')
      .trim();
    const mashhadDistrict = fa.match(/^مشهد\s+(\d+)$/);
    if (mashhadDistrict) {
      keys.push(this.normalizeCityKey(`منطقه ${mashhadDistrict[1]}`));
    }
    if (fa === 'مشهد ثامن' || fa === 'مشهد 8') {
      keys.push(this.normalizeCityKey('منطقه 8 (ثامن)'));
      keys.push(this.normalizeCityKey('ثامن'));
    }
    if (fa === 'آشخانه' || fa === 'سملقان') {
      keys.push(this.normalizeCityKey('مانه و سملقان'));
    }
    const parts = fa.split(/\s+/);
    const lastPart = parts[parts.length - 1] ?? '';
    if (
      parts.length > 1 &&
      parts[0].length >= 3 &&
      !/^\d+$/.test(lastPart) &&
      !/ثامن|منطقه/.test(fa)
    ) {
      keys.push(this.normalizeCityKey(parts[0]));
    }
    return keys.filter(Boolean);
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
        for (const key of this.cityLookupKeys(city.nameFa, city.nameEn)) {
          if (!cityIdByKey.has(key)) {
            cityIdByKey.set(key, city.id);
          }
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
    nationalId?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    gender?: UserGender | null;
  }) {
    const identity = (dto.nationalId ?? '').trim();
    const phone = dto.phone ? normalizePhone(dto.phone) : '';
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const birthDate = parseDateOnly(dto.birthDate);

    if (identity) {
      const byNationalId = await this.prisma.user.findUnique({
        where: { nationalId: identity },
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
    let username = identity || `p${Date.now().toString(36)}`;
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (usernameTaken) {
      username = `${username}_${Date.now().toString(36)}`;
    }

    const passwordHash = await bcrypt.hash(identity || username, 10);
    const created = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        firstName,
        lastName,
        fullName: joinFullName(firstName, lastName),
        nationalId: identity || null,
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

  async updatePilgrimIdentity(
    id: string,
    dto: {
      firstName: string;
      lastName: string;
      nationalId?: string | null;
      passportNumber?: string | null;
      phone?: string | null;
      birthDate?: string | null;
      gender: UserGender;
    },
  ) {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const nationalId =
      (dto.nationalId ?? '').trim() ||
      (dto.passportNumber ?? '').trim() ||
      null;
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const phone = dto.phone ? normalizePhone(dto.phone) || null : null;
    const birthDate = parseDateOnly(dto.birthDate);
    const syncUsername =
      Boolean(current.nationalId) && current.username === current.nationalId;

    await this.assertUniqueIdentity(
      {
        nationalId,
        phone,
        username: syncUsername && nationalId ? nationalId : undefined,
      },
      id,
    );
    await this.ensureRole(id, 'PILGRIM');

    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          firstName,
          lastName,
          fullName: joinFullName(firstName, lastName),
          nationalId,
          phone,
          gender: dto.gender,
          birthDate,
          ...(syncUsername && nationalId ? { username: nationalId } : {}),
        },
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
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
      select: { username: true, nationalId: true, phone: true, email: true, fullName: true },
    });

    for (const row of matches) {
      if (nationalId && row.nationalId === nationalId) {
        const name = row.fullName.trim();
        throw new ConflictException(
          name
            ? `این کد ملی متعلق به ${name} است و امکان ثبت مجدد آن وجود ندارد`
            : 'کد ملی تکراری است',
        );
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
