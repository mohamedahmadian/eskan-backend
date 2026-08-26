import { BadRequestException, Injectable } from '@nestjs/common';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear } from '../common/jalali-year';
import { localizedGeoName } from '../common/request-locale';
import {
  AccommodationStatus,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { NationalMonitoringExportSection } from './dto/find-national-monitoring-query.dto';

type PlaceRow = {
  id: string;
  nameFa: string;
  nameEn: string;
  pilgrims: number;
  pilgrimMale: number;
  pilgrimFemale: number;
  reservationCount: number;
  caravanCount: number;
  accommodationCount: number;
  activeAccommodationCount: number;
  lodgingMale: number;
  lodgingFemale: number;
};

type RouteRow = {
  id: string | null;
  name: string;
  pilgrims: number;
  pilgrimMale: number;
  pilgrimFemale: number;
  reservationCount: number;
  caravanCount: number;
  groupCount: number;
};

const inactiveReservation = new Set<ReservationStatus>([
  ReservationStatus.CANCELLED,
  ReservationStatus.REJECTED,
]);

function emptyPlace(id: string, nameFa: string, nameEn: string): PlaceRow {
  return {
    id,
    nameFa,
    nameEn,
    pilgrims: 0,
    pilgrimMale: 0,
    pilgrimFemale: 0,
    reservationCount: 0,
    caravanCount: 0,
    accommodationCount: 0,
    activeAccommodationCount: 0,
    lodgingMale: 0,
    lodgingFemale: 0,
  };
}

function emptyRoute(id: string | null, name: string): RouteRow {
  return {
    id,
    name,
    pilgrims: 0,
    pilgrimMale: 0,
    pilgrimFemale: 0,
    reservationCount: 0,
    caravanCount: 0,
    groupCount: 0,
  };
}

function serializePlace(row: PlaceRow) {
  const lodgingTotal = row.lodgingMale + row.lodgingFemale;
  return {
    id: row.id,
    nameFa: row.nameFa,
    nameEn: row.nameEn,
    pilgrims: row.pilgrims,
    pilgrimMale: row.pilgrimMale,
    pilgrimFemale: row.pilgrimFemale,
    reservationCount: row.reservationCount,
    caravanCount: row.caravanCount,
    accommodationCount: row.accommodationCount,
    activeAccommodationCount: row.activeAccommodationCount,
    lodgingCapacity: {
      male: row.lodgingMale,
      female: row.lodgingFemale,
      total: lodgingTotal,
    },
    lodgingGap: lodgingTotal - row.pilgrims,
  };
}

function serializeRoute(row: RouteRow) {
  return {
    id: row.id,
    name: row.name,
    pilgrims: row.pilgrims,
    pilgrimMale: row.pilgrimMale,
    pilgrimFemale: row.pilgrimFemale,
    reservationCount: row.reservationCount,
    caravanCount: row.caravanCount,
    groupCount: row.groupCount,
  };
}

function comparePlace(a: PlaceRow, b: PlaceRow) {
  return b.pilgrims - a.pilgrims || a.nameFa.localeCompare(b.nameFa, 'fa');
}

function highlightPlace(row: PlaceRow | undefined) {
  if (!row || row.pilgrims <= 0) return null;
  return {
    id: row.id,
    nameFa: row.nameFa,
    nameEn: row.nameEn,
    pilgrims: row.pilgrims,
  };
}

function highlightRoute(row: RouteRow | undefined) {
  if (!row || !row.id || row.pilgrims <= 0) return null;
  return {
    id: row.id,
    name: row.name,
    pilgrims: row.pilgrims,
  };
}

@Injectable()
export class NationalMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(year?: number) {
    const data = await this.load(year);
    const provinces = [...data.provinces.values()].sort(comparePlace);
    const cities = [...data.cities.values()]
      .filter(
        (row) =>
          row.pilgrims > 0 ||
          row.caravanCount > 0 ||
          row.accommodationCount > 0,
      )
      .sort(comparePlace);
    const routes = [...data.routes.values()].sort((a, b) => {
      if (!a.id && b.id) return 1;
      if (a.id && !b.id) return -1;
      return b.pilgrims - a.pilgrims || a.name.localeCompare(b.name, 'fa');
    });

    const tightest = [...provinces]
      .filter((row) => row.pilgrims > 0)
      .sort((a, b) => a.lodgingMale + a.lodgingFemale - a.pilgrims - (b.lodgingMale + b.lodgingFemale - b.pilgrims))[0];

    return {
      year: data.year,
      totals: {
        pilgrims: data.totals.pilgrims,
        pilgrimMale: data.totals.pilgrimMale,
        pilgrimFemale: data.totals.pilgrimFemale,
        reservationCount: data.totals.reservationCount,
        caravanCount: data.totals.caravanCount,
        accommodationCount: data.totals.accommodationCount,
        activeAccommodationCount: data.totals.activeAccommodationCount,
        lodgingCapacity: {
          male: data.totals.lodgingMale,
          female: data.totals.lodgingFemale,
          total: data.totals.lodgingMale + data.totals.lodgingFemale,
        },
        lodgingGap:
          data.totals.lodgingMale +
          data.totals.lodgingFemale -
          data.totals.pilgrims,
      },
      highlights: {
        busiestProvince: highlightPlace(provinces[0]),
        busiestCity: highlightPlace(cities[0]),
        busiestRoute: highlightRoute(routes.find((row) => row.id)),
        tightestProvince: tightest
          ? {
              id: tightest.id,
              nameFa: tightest.nameFa,
              nameEn: tightest.nameEn,
              pilgrims: tightest.pilgrims,
              lodgingCapacity: tightest.lodgingMale + tightest.lodgingFemale,
              lodgingGap:
                tightest.lodgingMale + tightest.lodgingFemale - tightest.pilgrims,
            }
          : null,
      },
      byProvince: provinces.map(serializePlace),
      byCity: cities.map((row) => ({
        ...serializePlace(row),
        provinceId: data.cityProvince.get(row.id) ?? '',
        provinceNameFa: data.cityProvinceName.get(row.id) ?? '',
        provinceNameEn: data.cityProvinceNameEn.get(row.id) ?? '',
      })),
      byWalkingRoute: routes.map(serializeRoute),
    };
  }

  async export(section: NationalMonitoringExportSection, year?: number) {
    const data = await this.dashboard(year);
    if (section === 'province') {
      const buffer = await buildStyledExcelExport({
        sheetName: 'استان‌ها',
        columns: [
          { header: 'استان', key: 'nameFa', width: 22 },
          { header: 'زائر', key: 'pilgrims', width: 12 },
          { header: 'مرد', key: 'pilgrimMale', width: 10 },
          { header: 'زن', key: 'pilgrimFemale', width: 10 },
          { header: 'پرونده', key: 'reservationCount', width: 12 },
          { header: 'کاروان', key: 'caravanCount', width: 12 },
          { header: 'اسکان', key: 'accommodationCount', width: 12 },
          { header: 'اسکان فعال', key: 'activeAccommodationCount', width: 14 },
          { header: 'ظرفیت اسکان', key: 'lodgingTotal', width: 14 },
          { header: 'مازاد/کسری ظرفیت', key: 'lodgingGap', width: 18 },
        ],
        rows: data.byProvince.map((row) => ({
          nameFa: localizedGeoName(row),
          pilgrims: row.pilgrims,
          pilgrimMale: row.pilgrimMale,
          pilgrimFemale: row.pilgrimFemale,
          reservationCount: row.reservationCount,
          caravanCount: row.caravanCount,
          accommodationCount: row.accommodationCount,
          activeAccommodationCount: row.activeAccommodationCount,
          lodgingTotal: row.lodgingCapacity.total,
          lodgingGap: row.lodgingGap,
        })),
      });
      return { buffer, filename: 'national-monitoring-provinces.xlsx' };
    }
    if (section === 'city') {
      const buffer = await buildStyledExcelExport({
        sheetName: 'شهرها',
        columns: [
          { header: 'شهر', key: 'nameFa', width: 22 },
          { header: 'استان', key: 'provinceNameFa', width: 20 },
          { header: 'زائر', key: 'pilgrims', width: 12 },
          { header: 'مرد', key: 'pilgrimMale', width: 10 },
          { header: 'زن', key: 'pilgrimFemale', width: 10 },
          { header: 'کاروان', key: 'caravanCount', width: 12 },
          { header: 'اسکان', key: 'accommodationCount', width: 12 },
          { header: 'ظرفیت اسکان', key: 'lodgingTotal', width: 14 },
          { header: 'مازاد/کسری ظرفیت', key: 'lodgingGap', width: 18 },
        ],
        rows: data.byCity.map((row) => ({
          nameFa: localizedGeoName(row),
          provinceNameFa: localizedGeoName({
            nameFa: row.provinceNameFa,
            nameEn: row.provinceNameEn,
          }),
          pilgrims: row.pilgrims,
          pilgrimMale: row.pilgrimMale,
          pilgrimFemale: row.pilgrimFemale,
          caravanCount: row.caravanCount,
          accommodationCount: row.accommodationCount,
          lodgingTotal: row.lodgingCapacity.total,
          lodgingGap: row.lodgingGap,
        })),
      });
      return { buffer, filename: 'national-monitoring-cities.xlsx' };
    }
    if (section === 'route') {
      const buffer = await buildStyledExcelExport({
        sheetName: 'مسیرهای پیاده',
        columns: [
          { header: 'مسیر', key: 'name', width: 28 },
          { header: 'زائر', key: 'pilgrims', width: 12 },
          { header: 'مرد', key: 'pilgrimMale', width: 10 },
          { header: 'زن', key: 'pilgrimFemale', width: 10 },
          { header: 'پرونده', key: 'reservationCount', width: 12 },
          { header: 'کاروان', key: 'caravanCount', width: 12 },
          { header: 'گروه', key: 'groupCount', width: 10 },
        ],
        rows: data.byWalkingRoute.map((row) => ({
          name: row.name,
          pilgrims: row.pilgrims,
          pilgrimMale: row.pilgrimMale,
          pilgrimFemale: row.pilgrimFemale,
          reservationCount: row.reservationCount,
          caravanCount: row.caravanCount,
          groupCount: row.groupCount,
        })),
      });
      return { buffer, filename: 'national-monitoring-routes.xlsx' };
    }
    throw new BadRequestException('بخش خروجی نامعتبر است');
  }

  private async load(year?: number) {
    const selectedYear = year ?? currentJalaliYear();
    const iran = { country: { iso2: 'IR' } } as const;

    const [
      provincesRaw,
      citiesRaw,
      routesRaw,
      reservations,
      caravans,
      groups,
      accommodations,
    ] = await Promise.all([
      this.prisma.province.findMany({
        where: iran,
        select: { id: true, nameFa: true, nameEn: true },
        orderBy: { nameFa: 'asc' },
      }),
      this.prisma.city.findMany({
        where: { province: iran },
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          provinceId: true,
          province: { select: { nameFa: true, nameEn: true } },
        },
      }),
      this.prisma.walkingRoute.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: {
          year: selectedYear,
          status: { notIn: [...inactiveReservation] },
        },
        select: {
          maleCount: true,
          femaleCount: true,
          walkingRouteId: true,
          originCity: { select: { id: true, provinceId: true } },
          caravan: {
            select: {
              walkingRouteId: true,
              cityId: true,
              city: { select: { provinceId: true } },
            },
          },
          group: {
            select: {
              walkingRouteId: true,
              cityId: true,
              city: { select: { provinceId: true } },
            },
          },
        },
      }),
      this.prisma.caravan.findMany({
        where: { city: { province: iran } },
        select: {
          cityId: true,
          walkingRouteId: true,
          city: { select: { provinceId: true } },
        },
      }),
      this.prisma.group.findMany({
        where: { city: { province: iran } },
        select: { walkingRouteId: true },
      }),
      this.prisma.accommodation.findMany({
        where: {
          status: { not: AccommodationStatus.INACTIVE },
          OR: [{ province: iran }, { city: { province: iran } }, { country: { iso2: 'IR' } }],
        },
        select: {
          provinceId: true,
          cityId: true,
          maleCapacity: true,
          femaleCapacity: true,
          managers: {
            where: { year: selectedYear },
            select: { id: true },
            take: 1,
          },
        },
      }),
    ]);

    const provinces = new Map(
      provincesRaw.map((item) => [
        item.id,
        emptyPlace(item.id, item.nameFa, item.nameEn),
      ]),
    );
    const cities = new Map(
      citiesRaw.map((item) => [
        item.id,
        emptyPlace(item.id, item.nameFa, item.nameEn),
      ]),
    );
    const cityProvince = new Map(
      citiesRaw.map((item) => [item.id, item.provinceId]),
    );
    const cityProvinceName = new Map(
      citiesRaw.map((item) => [item.id, item.province.nameFa]),
    );
    const cityProvinceNameEn = new Map(
      citiesRaw.map((item) => [item.id, item.province.nameEn]),
    );
    const routes = new Map(
      routesRaw.map((item) => [item.id, emptyRoute(item.id, item.name)]),
    );
    const unspecifiedRoute = emptyRoute(null, '');

    const totals = {
      pilgrims: 0,
      pilgrimMale: 0,
      pilgrimFemale: 0,
      reservationCount: 0,
      caravanCount: 0,
      accommodationCount: 0,
      activeAccommodationCount: 0,
      lodgingMale: 0,
      lodgingFemale: 0,
    };

    for (const reservation of reservations) {
      const origin =
        reservation.originCity ??
        (reservation.caravan
          ? {
              id: reservation.caravan.cityId,
              provinceId: reservation.caravan.city.provinceId,
            }
          : reservation.group
            ? {
                id: reservation.group.cityId,
                provinceId: reservation.group.city.provinceId,
              }
            : null);
      const male = reservation.maleCount;
      const female = reservation.femaleCount;
      if (origin && cities.has(origin.id)) {
        const city = cities.get(origin.id)!;
        const province = provinces.get(origin.provinceId);
        city.pilgrims += male + female;
        city.pilgrimMale += male;
        city.pilgrimFemale += female;
        city.reservationCount += 1;
        if (province) {
          province.pilgrims += male + female;
          province.pilgrimMale += male;
          province.pilgrimFemale += female;
          province.reservationCount += 1;
        }
        totals.pilgrims += male + female;
        totals.pilgrimMale += male;
        totals.pilgrimFemale += female;
        totals.reservationCount += 1;
      }

      const routeId =
        reservation.walkingRouteId ??
        reservation.caravan?.walkingRouteId ??
        reservation.group?.walkingRouteId ??
        null;
      const route = routeId ? routes.get(routeId) : unspecifiedRoute;
      if (route) {
        route.pilgrims += male + female;
        route.pilgrimMale += male;
        route.pilgrimFemale += female;
        route.reservationCount += 1;
      }
    }

    for (const caravan of caravans) {
      totals.caravanCount += 1;
      const city = cities.get(caravan.cityId);
      const province = provinces.get(caravan.city.provinceId);
      if (city) city.caravanCount += 1;
      if (province) province.caravanCount += 1;
      const route = caravan.walkingRouteId
        ? routes.get(caravan.walkingRouteId)
        : unspecifiedRoute;
      if (route) route.caravanCount += 1;
    }

    for (const group of groups) {
      const route = group.walkingRouteId
        ? routes.get(group.walkingRouteId)
        : unspecifiedRoute;
      if (route) route.groupCount += 1;
    }

    if (unspecifiedRoute.reservationCount > 0 || unspecifiedRoute.caravanCount > 0) {
      routes.set('', unspecifiedRoute);
    }

    for (const item of accommodations) {
      const provinceId = item.provinceId ?? (item.cityId ? cityProvince.get(item.cityId) : null);
      const cityId = item.cityId;
      const active = item.managers.length > 0;
      totals.accommodationCount += 1;
      totals.lodgingMale += item.maleCapacity;
      totals.lodgingFemale += item.femaleCapacity;
      if (active) totals.activeAccommodationCount += 1;
      if (cityId && cities.has(cityId)) {
        const city = cities.get(cityId)!;
        city.accommodationCount += 1;
        city.lodgingMale += item.maleCapacity;
        city.lodgingFemale += item.femaleCapacity;
        if (active) city.activeAccommodationCount += 1;
      }
      if (provinceId && provinces.has(provinceId)) {
        const province = provinces.get(provinceId)!;
        province.accommodationCount += 1;
        province.lodgingMale += item.maleCapacity;
        province.lodgingFemale += item.femaleCapacity;
        if (active) province.activeAccommodationCount += 1;
      }
    }

    return {
      year: selectedYear,
      provinces,
      cities,
      routes,
      cityProvince,
      cityProvinceName,
      cityProvinceNameEn,
      totals,
    };
  }
}
