import { Injectable, NotFoundException } from '@nestjs/common';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear } from '../common/jalali-year';
import { localizedGeoName } from '../common/request-locale';
import { ReservationStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Counts = {
  caravanCount: number;
  activeCaravanCount: number;
  groupCount: number;
  caravanCapacityMale: number;
  caravanCapacityFemale: number;
  reservationCount: number;
  reservationMale: number;
  reservationFemale: number;
  residentPilgrims: number;
};

type PlaceMeta = {
  id: string;
  nameFa: string;
  nameEn: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
};

type CityMeta = PlaceMeta & {
  provinceId: string;
  isProvinceCapital: boolean;
};

type CaravanRow = {
  id: string;
  name: string;
  cityId: string;
  cityNameFa: string;
  provinceId: string;
  active: boolean;
  capacityMale: number;
  capacityFemale: number;
  reservationCount: number;
  reservationMale: number;
  reservationFemale: number;
};

type GroupRow = {
  id: string;
  name: string;
  cityId: string;
  cityNameFa: string;
  provinceId: string;
  capacityMale: number;
  capacityFemale: number;
  reservationCount: number;
  reservationMale: number;
  reservationFemale: number;
};

const inactiveReservation = new Set<ReservationStatus>([
  ReservationStatus.CANCELLED,
  ReservationStatus.REJECTED,
]);

function emptyCounts(): Counts {
  return {
    caravanCount: 0,
    activeCaravanCount: 0,
    groupCount: 0,
    caravanCapacityMale: 0,
    caravanCapacityFemale: 0,
    reservationCount: 0,
    reservationMale: 0,
    reservationFemale: 0,
    residentPilgrims: 0,
  };
}

function serializeCounts(row: Counts) {
  return {
    caravanCount: row.caravanCount,
    activeCaravanCount: row.activeCaravanCount,
    groupCount: row.groupCount,
    caravanCapacity: {
      male: row.caravanCapacityMale,
      female: row.caravanCapacityFemale,
      total: row.caravanCapacityMale + row.caravanCapacityFemale,
    },
    reservationCount: row.reservationCount,
    reservationPilgrims: {
      male: row.reservationMale,
      female: row.reservationFemale,
      total: row.reservationMale + row.reservationFemale,
    },
    residentPilgrims: row.residentPilgrims,
  };
}

function coord(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function averageCoord(
  items: { latitude: number | null; longitude: number | null }[],
): { latitude: number | null; longitude: number | null } {
  let latSum = 0;
  let lngSum = 0;
  let count = 0;
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    latSum += item.latitude;
    lngSum += item.longitude;
    count += 1;
  }
  if (count === 0) return { latitude: null, longitude: null };
  return { latitude: latSum / count, longitude: lngSum / count };
}

function hasActivity(row: Counts) {
  return (
    row.caravanCount > 0 ||
    row.groupCount > 0 ||
    row.reservationCount > 0 ||
    row.residentPilgrims > 0
  );
}

function compareFaName(a: string, b: string) {
  return a.localeCompare(b, 'fa');
}

@Injectable()
export class ProvincialMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async map(year?: number) {
    const snapshot = await this.loadSnapshot(year);
    const provinces = snapshot.provinces
      .map((province) => this.serializePlace(province, snapshot.provinceCounts.get(province.id)!))
      .sort(
        (a, b) =>
          b.reservationPilgrims.total - a.reservationPilgrims.total ||
          compareFaName(a.nameFa, b.nameFa),
      );
    const cities = snapshot.cities
      .filter((city) => hasActivity(snapshot.cityCounts.get(city.id)!))
      .map((city) => ({
        ...this.serializePlace(city, snapshot.cityCounts.get(city.id)!),
        provinceId: city.provinceId,
        provinceNameFa: snapshot.provinceById.get(city.provinceId)?.nameFa ?? '',
        provinceNameEn: snapshot.provinceById.get(city.provinceId)?.nameEn ?? '',
        isProvinceCapital: city.isProvinceCapital,
      }))
      .sort(
        (a, b) =>
          b.reservationPilgrims.total - a.reservationPilgrims.total ||
          compareFaName(a.nameFa, b.nameFa),
      );
    return {
      year: snapshot.year,
      totals: serializeCounts(snapshot.totals),
      provinces,
      cities,
      lookup: {
        provinces: snapshot.provinces
          .map((item) => ({
            id: item.id,
            nameFa: item.nameFa,
            nameEn: item.nameEn,
            code: item.code,
          }))
          .sort((a, b) => compareFaName(a.nameFa, b.nameFa)),
        cities: snapshot.cities
          .map((item) => ({
            id: item.id,
            nameFa: item.nameFa,
            nameEn: item.nameEn,
            code: item.code,
            provinceId: item.provinceId,
            provinceNameFa: snapshot.provinceById.get(item.provinceId)?.nameFa ?? '',
            provinceNameEn: snapshot.provinceById.get(item.provinceId)?.nameEn ?? '',
          }))
          .sort((a, b) => compareFaName(a.nameFa, b.nameFa)),
      },
    };
  }

  async province(id: string, year?: number) {
    const snapshot = await this.loadSnapshot(year);
    const province = snapshot.provinceById.get(id);
    if (!province) {
      throw new NotFoundException('استان یافت نشد');
    }
    const cities = snapshot.cities
      .filter((city) => city.provinceId === id)
      .map((city) =>
        this.serializePlace(city, snapshot.cityCounts.get(city.id)!),
      )
      .sort(
        (a, b) =>
          b.reservationPilgrims.total - a.reservationPilgrims.total ||
          compareFaName(a.nameFa, b.nameFa),
      );
    return {
      year: snapshot.year,
      province: {
        id: province.id,
        nameFa: province.nameFa,
        nameEn: province.nameEn,
        code: province.code,
        latitude: province.latitude,
        longitude: province.longitude,
      },
      totals: serializeCounts(snapshot.provinceCounts.get(id)!),
      cities,
      caravans: snapshot.caravans
        .filter((item) => item.provinceId === id)
        .sort(
          (a, b) =>
            b.reservationMale +
              b.reservationFemale -
              (a.reservationMale + a.reservationFemale) ||
            compareFaName(a.name, b.name),
        )
        .map((item) => this.serializeCaravan(item)),
      groups: snapshot.groups
        .filter((item) => item.provinceId === id)
        .sort(
          (a, b) =>
            b.reservationMale +
              b.reservationFemale -
              (a.reservationMale + a.reservationFemale) ||
            compareFaName(a.name, b.name),
        )
        .map((item) => this.serializeGroup(item)),
    };
  }

  async city(id: string, year?: number) {
    const snapshot = await this.loadSnapshot(year);
    const city = snapshot.cityById.get(id);
    if (!city) {
      throw new NotFoundException('شهر یافت نشد');
    }
    const province = snapshot.provinceById.get(city.provinceId)!;
    return {
      year: snapshot.year,
      city: {
        id: city.id,
        nameFa: city.nameFa,
        nameEn: city.nameEn,
        code: city.code,
        latitude: city.latitude,
        longitude: city.longitude,
        isProvinceCapital: city.isProvinceCapital,
        province: {
          id: province.id,
          nameFa: province.nameFa,
          nameEn: province.nameEn,
          code: province.code,
        },
      },
      totals: serializeCounts(snapshot.cityCounts.get(id)!),
      caravans: snapshot.caravans
        .filter((item) => item.cityId === id)
        .sort(
          (a, b) =>
            b.reservationMale +
              b.reservationFemale -
              (a.reservationMale + a.reservationFemale) ||
            compareFaName(a.name, b.name),
        )
        .map((item) => this.serializeCaravan(item)),
      groups: snapshot.groups
        .filter((item) => item.cityId === id)
        .sort(
          (a, b) =>
            b.reservationMale +
              b.reservationFemale -
              (a.reservationMale + a.reservationFemale) ||
            compareFaName(a.name, b.name),
        )
        .map((item) => this.serializeGroup(item)),
    };
  }

  async exportMap(year?: number) {
    const data = await this.map(year);
    const buffer = await buildStyledExcelExport({
      sheetName: 'پایش استانی و شهری',
      columns: [
        { header: 'استان', key: 'nameFa', width: 24 },
        { header: 'کد', key: 'code', width: 10 },
        { header: 'کاروان', key: 'caravanCount', width: 12 },
        { header: 'کاروان فعال', key: 'activeCaravanCount', width: 14 },
        { header: 'گروه', key: 'groupCount', width: 10 },
        { header: 'ظرفیت کاروان', key: 'capacityTotal', width: 16 },
        { header: 'پرونده زیارتی', key: 'reservationCount', width: 16 },
        { header: 'زائر اعزامی', key: 'reservationPilgrims', width: 14 },
        { header: 'زائر مرد', key: 'reservationMale', width: 12 },
        { header: 'زائر زن', key: 'reservationFemale', width: 12 },
        { header: 'زائر ساکن', key: 'residentPilgrims', width: 14 },
      ],
      rows: data.provinces.map((item) => ({
        nameFa: localizedGeoName(item),
        code: item.code,
        caravanCount: item.caravanCount,
        activeCaravanCount: item.activeCaravanCount,
        groupCount: item.groupCount,
        capacityTotal: item.caravanCapacity.total,
        reservationCount: item.reservationCount,
        reservationPilgrims: item.reservationPilgrims.total,
        reservationMale: item.reservationPilgrims.male,
        reservationFemale: item.reservationPilgrims.female,
        residentPilgrims: item.residentPilgrims,
      })),
    });
    return { buffer, filename: 'provincial-monitoring.xlsx' };
  }

  async exportProvince(id: string, year?: number) {
    const data = await this.province(id, year);
    const buffer = await buildStyledExcelExport({
      sheetName: localizedGeoName(data.province),
      columns: [
        { header: 'شهر', key: 'nameFa', width: 24 },
        { header: 'کاروان', key: 'caravanCount', width: 12 },
        { header: 'کاروان فعال', key: 'activeCaravanCount', width: 14 },
        { header: 'گروه', key: 'groupCount', width: 10 },
        { header: 'ظرفیت کاروان', key: 'capacityTotal', width: 16 },
        { header: 'پرونده زیارتی', key: 'reservationCount', width: 16 },
        { header: 'زائر اعزامی', key: 'reservationPilgrims', width: 14 },
        { header: 'زائر مرد', key: 'reservationMale', width: 12 },
        { header: 'زائر زن', key: 'reservationFemale', width: 12 },
        { header: 'زائر ساکن', key: 'residentPilgrims', width: 14 },
      ],
      rows: data.cities.map((item) => ({
        nameFa: localizedGeoName(item),
        caravanCount: item.caravanCount,
        activeCaravanCount: item.activeCaravanCount,
        groupCount: item.groupCount,
        capacityTotal: item.caravanCapacity.total,
        reservationCount: item.reservationCount,
        reservationPilgrims: item.reservationPilgrims.total,
        reservationMale: item.reservationPilgrims.male,
        reservationFemale: item.reservationPilgrims.female,
        residentPilgrims: item.residentPilgrims,
      })),
    });
    return { buffer, filename: 'provincial-monitoring-cities.xlsx' };
  }

  async exportCity(id: string, year?: number) {
    const data = await this.city(id, year);
    const buffer = await buildStyledExcelExport({
      sheetName: data.city.nameFa,
      columns: [
        { header: 'کاروان', key: 'name', width: 28 },
        { header: 'فعال در سال', key: 'active', width: 14 },
        { header: 'ظرفیت مرد', key: 'capacityMale', width: 14 },
        { header: 'ظرفیت زن', key: 'capacityFemale', width: 12 },
        { header: 'ظرفیت کل', key: 'capacityTotal', width: 12 },
        { header: 'پرونده زیارتی', key: 'reservationCount', width: 16 },
        { header: 'زائر اعزامی', key: 'reservationPilgrims', width: 14 },
        { header: 'زائر مرد', key: 'reservationMale', width: 12 },
        { header: 'زائر زن', key: 'reservationFemale', width: 12 },
      ],
      rows: data.caravans.map((item) => ({
        name: item.name,
        active: item.active ? 'بله' : 'خیر',
        capacityMale: item.capacity.male,
        capacityFemale: item.capacity.female,
        capacityTotal: item.capacity.total,
        reservationCount: item.reservationCount,
        reservationPilgrims: item.reservationPilgrims.total,
        reservationMale: item.reservationPilgrims.male,
        reservationFemale: item.reservationPilgrims.female,
      })),
    });
    return { buffer, filename: 'provincial-monitoring-caravans.xlsx' };
  }

  private serializePlace(place: PlaceMeta, counts: Counts) {
    return {
      id: place.id,
      nameFa: place.nameFa,
      nameEn: place.nameEn,
      code: place.code,
      latitude: place.latitude,
      longitude: place.longitude,
      ...serializeCounts(counts),
    };
  }

  private serializeCaravan(item: CaravanRow) {
    return {
      id: item.id,
      name: item.name,
      cityId: item.cityId,
      cityNameFa: item.cityNameFa,
      active: item.active,
      capacity: {
        male: item.capacityMale,
        female: item.capacityFemale,
        total: item.capacityMale + item.capacityFemale,
      },
      reservationCount: item.reservationCount,
      reservationPilgrims: {
        male: item.reservationMale,
        female: item.reservationFemale,
        total: item.reservationMale + item.reservationFemale,
      },
    };
  }

  private serializeGroup(item: GroupRow) {
    return {
      id: item.id,
      name: item.name,
      cityId: item.cityId,
      cityNameFa: item.cityNameFa,
      capacity: {
        male: item.capacityMale,
        female: item.capacityFemale,
        total: item.capacityMale + item.capacityFemale,
      },
      reservationCount: item.reservationCount,
      reservationPilgrims: {
        male: item.reservationMale,
        female: item.reservationFemale,
        total: item.reservationMale + item.reservationFemale,
      },
    };
  }

  private async loadSnapshot(year?: number) {
    const selectedYear = year ?? currentJalaliYear();
    const iranFilter = { country: { iso2: 'IR' } } as const;

    const [provincesRaw, citiesRaw, caravansRaw, groupsRaw, reservations, residentByCity, residentByProvinceOnly] =
      await Promise.all([
        this.prisma.province.findMany({
          where: iranFilter,
          select: {
            id: true,
            nameFa: true,
            nameEn: true,
            code: true,
            latitude: true,
            longitude: true,
          },
          orderBy: { nameFa: 'asc' },
        }),
        this.prisma.city.findMany({
          where: { province: iranFilter },
          select: {
            id: true,
            provinceId: true,
            nameFa: true,
            nameEn: true,
            code: true,
            latitude: true,
            longitude: true,
            isProvinceCapital: true,
          },
        }),
        this.prisma.caravan.findMany({
          where: { city: { province: iranFilter } },
          select: {
            id: true,
            name: true,
            cityId: true,
            city: { select: { nameFa: true, provinceId: true } },
            years: {
              where: { year: selectedYear },
              select: { maleCount: true, femaleCount: true },
            },
          },
        }),
        this.prisma.group.findMany({
          where: { city: { province: iranFilter } },
          select: {
            id: true,
            name: true,
            cityId: true,
            maleCount: true,
            femaleCount: true,
            city: { select: { nameFa: true, provinceId: true } },
          },
        }),
        this.prisma.reservation.findMany({
          where: {
            year: selectedYear,
            status: { notIn: [...inactiveReservation] },
          },
          select: {
            originCityId: true,
            caravanId: true,
            groupId: true,
            maleCount: true,
            femaleCount: true,
            originCity: { select: { id: true, provinceId: true } },
            caravan: { select: { cityId: true, city: { select: { provinceId: true } } } },
            group: { select: { cityId: true, city: { select: { provinceId: true } } } },
          },
        }),
        this.prisma.user.groupBy({
          by: ['cityId'],
          where: {
            userRoles: { some: { role: { code: 'PILGRIM' } } },
            cityId: { not: null },
            city: { province: iranFilter },
          },
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({
          by: ['provinceId'],
          where: {
            userRoles: { some: { role: { code: 'PILGRIM' } } },
            cityId: null,
            provinceId: { not: null },
            province: iranFilter,
          },
          _count: { _all: true },
        }),
      ]);

    const cities: CityMeta[] = citiesRaw.map((item) => ({
      id: item.id,
      provinceId: item.provinceId,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      code: item.code,
      latitude: coord(item.latitude),
      longitude: coord(item.longitude),
      isProvinceCapital: item.isProvinceCapital,
    }));
    const citiesByProvince = new Map<string, CityMeta[]>();
    for (const city of cities) {
      const list = citiesByProvince.get(city.provinceId) ?? [];
      list.push(city);
      citiesByProvince.set(city.provinceId, list);
    }

    const provinces: PlaceMeta[] = provincesRaw.map((item) => {
      const fromDb = { latitude: coord(item.latitude), longitude: coord(item.longitude) };
      const fallback = averageCoord(citiesByProvince.get(item.id) ?? []);
      return {
        id: item.id,
        nameFa: item.nameFa,
        nameEn: item.nameEn,
        code: item.code,
        latitude: fromDb.latitude ?? fallback.latitude,
        longitude: fromDb.longitude ?? fallback.longitude,
      };
    });

    const provinceById = new Map(provinces.map((item) => [item.id, item]));
    const cityById = new Map(cities.map((item) => [item.id, item]));
    const provinceCounts = new Map(provinces.map((item) => [item.id, emptyCounts()]));
    const cityCounts = new Map(cities.map((item) => [item.id, emptyCounts()]));
    const totals = emptyCounts();

    const caravanReservation = new Map<
      string,
      { count: number; male: number; female: number }
    >();
    const groupReservation = new Map<
      string,
      { count: number; male: number; female: number }
    >();

    const bumpReservation = (
      map: Map<string, { count: number; male: number; female: number }>,
      id: string | null,
      male: number,
      female: number,
    ) => {
      if (!id) return;
      const row = map.get(id) ?? { count: 0, male: 0, female: 0 };
      row.count += 1;
      row.male += male;
      row.female += female;
      map.set(id, row);
    };

    const caravans: CaravanRow[] = caravansRaw.map((item) => {
      const yearRow = item.years[0];
      const row: CaravanRow = {
        id: item.id,
        name: item.name,
        cityId: item.cityId,
        cityNameFa: item.city.nameFa,
        provinceId: item.city.provinceId,
        active: Boolean(yearRow),
        capacityMale: yearRow?.maleCount ?? 0,
        capacityFemale: yearRow?.femaleCount ?? 0,
        reservationCount: 0,
        reservationMale: 0,
        reservationFemale: 0,
      };
      const cityRow = cityCounts.get(row.cityId);
      const provinceRow = provinceCounts.get(row.provinceId);
      if (cityRow) {
        cityRow.caravanCount += 1;
        if (row.active) {
          cityRow.activeCaravanCount += 1;
          cityRow.caravanCapacityMale += row.capacityMale;
          cityRow.caravanCapacityFemale += row.capacityFemale;
        }
      }
      if (provinceRow) {
        provinceRow.caravanCount += 1;
        if (row.active) {
          provinceRow.activeCaravanCount += 1;
          provinceRow.caravanCapacityMale += row.capacityMale;
          provinceRow.caravanCapacityFemale += row.capacityFemale;
        }
      }
      totals.caravanCount += 1;
      if (row.active) {
        totals.activeCaravanCount += 1;
        totals.caravanCapacityMale += row.capacityMale;
        totals.caravanCapacityFemale += row.capacityFemale;
      }
      return row;
    });
    const caravanById = new Map(caravans.map((item) => [item.id, item]));

    const groups: GroupRow[] = groupsRaw.map((item) => {
      const row: GroupRow = {
        id: item.id,
        name: item.name,
        cityId: item.cityId,
        cityNameFa: item.city.nameFa,
        provinceId: item.city.provinceId,
        capacityMale: item.maleCount,
        capacityFemale: item.femaleCount,
        reservationCount: 0,
        reservationMale: 0,
        reservationFemale: 0,
      };
      const cityRow = cityCounts.get(row.cityId);
      const provinceRow = provinceCounts.get(row.provinceId);
      if (cityRow) cityRow.groupCount += 1;
      if (provinceRow) provinceRow.groupCount += 1;
      totals.groupCount += 1;
      return row;
    });
    const groupById = new Map(groups.map((item) => [item.id, item]));

    for (const reservation of reservations) {
      const origin =
        reservation.originCity ??
        (reservation.caravan
          ? { id: reservation.caravan.cityId, provinceId: reservation.caravan.city.provinceId }
          : reservation.group
            ? { id: reservation.group.cityId, provinceId: reservation.group.city.provinceId }
            : null);
      if (!origin || !cityById.has(origin.id)) continue;
      const male = reservation.maleCount;
      const female = reservation.femaleCount;
      const cityRow = cityCounts.get(origin.id);
      const provinceRow = provinceCounts.get(origin.provinceId);
      if (cityRow) {
        cityRow.reservationCount += 1;
        cityRow.reservationMale += male;
        cityRow.reservationFemale += female;
      }
      if (provinceRow) {
        provinceRow.reservationCount += 1;
        provinceRow.reservationMale += male;
        provinceRow.reservationFemale += female;
      }
      totals.reservationCount += 1;
      totals.reservationMale += male;
      totals.reservationFemale += female;
      bumpReservation(caravanReservation, reservation.caravanId, male, female);
      bumpReservation(groupReservation, reservation.groupId, male, female);
    }

    for (const [id, stats] of caravanReservation) {
      const row = caravanById.get(id);
      if (!row) continue;
      row.reservationCount = stats.count;
      row.reservationMale = stats.male;
      row.reservationFemale = stats.female;
    }
    for (const [id, stats] of groupReservation) {
      const row = groupById.get(id);
      if (!row) continue;
      row.reservationCount = stats.count;
      row.reservationMale = stats.male;
      row.reservationFemale = stats.female;
    }

    for (const row of residentByCity) {
      if (!row.cityId) continue;
      const city = cityById.get(row.cityId);
      if (!city) continue;
      const count = row._count._all;
      cityCounts.get(row.cityId)!.residentPilgrims += count;
      provinceCounts.get(city.provinceId)!.residentPilgrims += count;
      totals.residentPilgrims += count;
    }
    for (const row of residentByProvinceOnly) {
      if (!row.provinceId || !provinceCounts.has(row.provinceId)) continue;
      const count = row._count._all;
      provinceCounts.get(row.provinceId)!.residentPilgrims += count;
      totals.residentPilgrims += count;
    }

    return {
      year: selectedYear,
      provinces,
      cities,
      provinceById,
      cityById,
      provinceCounts,
      cityCounts,
      caravans,
      groups,
      totals,
    };
  }
}
