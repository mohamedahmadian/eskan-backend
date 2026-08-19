import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateProvinceDto } from './dto/create-province.dto';
import { FindGeoQueryDto } from './dto/find-geo-query.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';

const representativeSelect = {
  id: true,
  fullName: true,
  username: true,
} satisfies Prisma.UserSelect;

const countrySelect = {
  id: true,
  iso2: true,
  iso3: true,
  phoneCode: true,
  nameFa: true,
  nameEn: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { provinces: true } },
} satisfies Prisma.CountrySelect;

const provinceSelect = {
  id: true,
  countryId: true,
  code: true,
  nameFa: true,
  nameEn: true,
  neshanAddress: true,
  latitude: true,
  longitude: true,
  hasRailway: true,
  hasAirport: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  country: {
    select: { id: true, iso2: true, nameFa: true, nameEn: true, isActive: true },
  },
  representativeId: true,
  representative: { select: representativeSelect },
  _count: { select: { cities: true } },
} satisfies Prisma.ProvinceSelect;

const citySelect = {
  id: true,
  provinceId: true,
  code: true,
  nameFa: true,
  nameEn: true,
  neshanAddress: true,
  latitude: true,
  longitude: true,
  hasRailway: true,
  hasAirport: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  representativeId: true,
  representative: { select: representativeSelect },
  province: {
    select: {
      id: true,
      code: true,
      nameFa: true,
      nameEn: true,
      isActive: true,
      countryId: true,
      representativeId: true,
      representative: { select: representativeSelect },
      country: {
        select: {
          id: true,
          iso2: true,
          nameFa: true,
          nameEn: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.CitySelect;

function nameFilter(q: string): Prisma.StringFilter {
  return { contains: q, mode: 'insensitive' };
}

function toDecimal(value?: number | null) {
  if (value === undefined) {
    return undefined;
  }
  return value == null ? null : new Prisma.Decimal(value);
}

function toCoord(value: Prisma.Decimal | null) {
  return value == null ? null : Number(value);
}

function withCoords<
  T extends { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
>(item: T) {
  return {
    ...item,
    latitude: toCoord(item.latitude),
    longitude: toCoord(item.longitude),
  };
}

function withCoordsList<
  T extends { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
>(items: T[]) {
  return items.map(withCoords);
}

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  async findCountries(query: FindGeoQueryDto) {
    const where: Prisma.CountryWhereInput = {
      isActive: query.activeOnly ? true : undefined,
      OR: query.q
        ? [
            { nameFa: nameFilter(query.q) },
            { nameEn: nameFilter(query.q) },
            { iso2: { contains: query.q, mode: 'insensitive' } },
            { iso3: { contains: query.q, mode: 'insensitive' } },
            { phoneCode: containsInsensitive(query.q) },
          ]
        : undefined,
    };
    if (!wantsPagination(query)) {
      return this.prisma.country.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
        select: countrySelect,
      });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.country.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
        skip,
        take,
        select: countrySelect,
      }),
      this.prisma.country.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findCountry(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      select: countrySelect,
    });
    if (!country) {
      throw new NotFoundException('کشور یافت نشد');
    }
    return country;
  }

  async createCountry(dto: CreateCountryDto) {
    try {
      return await this.prisma.country.create({
        data: this.countryData(dto),
        select: countrySelect,
      });
    } catch (error) {
      this.rethrowUnique(error, 'کد کشور تکراری است');
    }
  }

  async updateCountry(id: string, dto: UpdateCountryDto) {
    await this.findCountry(id);
    try {
      return await this.prisma.country.update({
        where: { id },
        data: this.countryData(dto),
        select: countrySelect,
      });
    } catch (error) {
      this.rethrowUnique(error, 'کد کشور تکراری است');
    }
  }

  async removeCountry(id: string) {
    await this.findCountry(id);
    const provinces = await this.prisma.province.count({
      where: { countryId: id },
    });
    if (provinces > 0) {
      throw new ConflictException('ابتدا استان‌های این کشور را حذف کنید');
    }
    await this.prisma.country.delete({ where: { id } });
    return { ok: true };
  }

  async findProvinces(query: FindGeoQueryDto) {
    const where: Prisma.ProvinceWhereInput = {
      countryId: query.countryId,
      isActive: query.activeOnly ? true : undefined,
      OR: query.q
        ? [
            { nameFa: nameFilter(query.q) },
            { nameEn: nameFilter(query.q) },
            { code: { contains: query.q, mode: 'insensitive' } },
            { neshanAddress: containsInsensitive(query.q) },
          ]
        : undefined,
    };
    if (!wantsPagination(query)) {
      return withCoordsList(
        await this.prisma.province.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
          select: provinceSelect,
        }),
      );
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.province.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
        skip,
        take,
        select: provinceSelect,
      }),
      this.prisma.province.count({ where }),
    ]);
    return paginatedResult(withCoordsList(items), total, page, pageSize);
  }

  async findProvince(id: string) {
    const province = await this.prisma.province.findUnique({
      where: { id },
      select: provinceSelect,
    });
    if (!province) {
      throw new NotFoundException('استان یافت نشد');
    }
    return withCoords(province);
  }

  async createProvince(dto: CreateProvinceDto) {
    await this.assertCountry(dto.countryId);
    try {
      return withCoords(
        await this.prisma.province.create({
          data: this.provinceData(dto),
          select: provinceSelect,
        }),
      );
    } catch (error) {
      this.rethrowUnique(error, 'کد استان در این کشور تکراری است');
    }
  }

  async updateProvince(id: string, dto: UpdateProvinceDto) {
    await this.findProvince(id);
    if (dto.countryId) {
      await this.assertCountry(dto.countryId);
    }
    try {
      return withCoords(
        await this.prisma.province.update({
          where: { id },
          data: this.provinceData(dto),
          select: provinceSelect,
        }),
      );
    } catch (error) {
      this.rethrowUnique(error, 'کد استان در این کشور تکراری است');
    }
  }

  async removeProvince(id: string) {
    await this.findProvince(id);
    const cities = await this.prisma.city.count({ where: { provinceId: id } });
    if (cities > 0) {
      throw new ConflictException('ابتدا شهرهای این استان را حذف کنید');
    }
    await this.prisma.province.delete({ where: { id } });
    return { ok: true };
  }

  async findCities(query: FindGeoQueryDto) {
    const where: Prisma.CityWhereInput = {
      provinceId: query.provinceId,
      province: query.countryId
        ? { countryId: query.countryId }
        : undefined,
      isActive: query.activeOnly ? true : undefined,
      OR: query.q
        ? [
            { nameFa: nameFilter(query.q) },
            { nameEn: nameFilter(query.q) },
            { code: { contains: query.q, mode: 'insensitive' } },
            { neshanAddress: containsInsensitive(query.q) },
          ]
        : undefined,
    };
    if (!wantsPagination(query)) {
      return withCoordsList(
        await this.prisma.city.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
          select: citySelect,
        }),
      );
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
        skip,
        take,
        select: citySelect,
      }),
      this.prisma.city.count({ where }),
    ]);
    return paginatedResult(withCoordsList(items), total, page, pageSize);
  }

  async findCity(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: citySelect,
    });
    if (!city) {
      throw new NotFoundException('شهر یافت نشد');
    }
    return withCoords(city);
  }

  async createCity(dto: CreateCityDto) {
    await this.assertProvince(dto.provinceId);
    try {
      return withCoords(
        await this.prisma.city.create({
          data: this.cityData(dto),
          select: citySelect,
        }),
      );
    } catch (error) {
      this.rethrowUnique(error, 'کد شهر در این استان تکراری است');
    }
  }

  async updateCity(id: string, dto: UpdateCityDto) {
    await this.findCity(id);
    if (dto.provinceId) {
      await this.assertProvince(dto.provinceId);
    }
    try {
      return withCoords(
        await this.prisma.city.update({
          where: { id },
          data: this.cityData(dto),
          select: citySelect,
        }),
      );
    } catch (error) {
      this.rethrowUnique(error, 'کد شهر در این استان تکراری است');
    }
  }

  async removeCity(id: string) {
    await this.findCity(id);
    await this.prisma.city.delete({ where: { id } });
    return { ok: true };
  }

  private countryData(dto: CreateCountryDto | UpdateCountryDto) {
    return {
      iso2: dto.iso2,
      iso3: dto.iso3,
      phoneCode: dto.phoneCode,
      nameFa: dto.nameFa?.trim(),
      nameEn: dto.nameEn?.trim(),
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    };
  }

  private provinceData(dto: CreateProvinceDto | UpdateProvinceDto) {
    return {
      countryId: dto.countryId,
      code: dto.code,
      nameFa: dto.nameFa?.trim(),
      nameEn: dto.nameEn?.trim(),
      neshanAddress: dto.neshanAddress,
      latitude: toDecimal(dto.latitude),
      longitude: toDecimal(dto.longitude),
      hasRailway: dto.hasRailway,
      hasAirport: dto.hasAirport,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    };
  }

  private cityData(dto: CreateCityDto | UpdateCityDto) {
    return {
      provinceId: dto.provinceId,
      code: dto.code,
      nameFa: dto.nameFa?.trim(),
      nameEn: dto.nameEn?.trim(),
      neshanAddress: dto.neshanAddress,
      latitude: toDecimal(dto.latitude),
      longitude: toDecimal(dto.longitude),
      hasRailway: dto.hasRailway,
      hasAirport: dto.hasAirport,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    };
  }

  private async assertCountry(id: string) {
    const country = await this.prisma.country.findUnique({ where: { id } });
    if (!country) {
      throw new NotFoundException('کشور یافت نشد');
    }
  }

  private async assertProvince(id: string) {
    const province = await this.prisma.province.findUnique({ where: { id } });
    if (!province) {
      throw new NotFoundException('استان یافت نشد');
    }
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
