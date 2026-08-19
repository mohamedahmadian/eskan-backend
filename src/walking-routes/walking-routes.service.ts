import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalkingRouteDto, type WalkingRouteStageDto } from './dto/create-walking-route.dto';
import { FindWalkingRoutesQueryDto } from './dto/find-walking-routes-query.dto';
import { UpdateWalkingRouteDto } from './dto/update-walking-route.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const walkingRouteInclude = {
  entryBorderCity: {
    select: {
      ...geoSelect,
      provinceId: true,
      province: { select: { ...geoSelect, countryId: true } },
    },
  },
  originCountries: {
    include: {
      country: { select: { ...geoSelect, iso2: true } },
    },
  },
  stages: {
    orderBy: { stageNumber: 'asc' as const },
    include: {
      city: {
        select: {
          ...geoSelect,
          provinceId: true,
          province: { select: { ...geoSelect, countryId: true } },
        },
      },
    },
  },
} satisfies Prisma.WalkingRouteInclude;

type WalkingRouteRecord = Prisma.WalkingRouteGetPayload<{
  include: typeof walkingRouteInclude;
}>;

@Injectable()
export class WalkingRoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindWalkingRoutesQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.walkingRoute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: walkingRouteInclude,
      }),
      this.prisma.walkingRoute.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.walkingRoute.findUnique({
      where: { id },
      include: walkingRouteInclude,
    });
    if (!item) {
      throw new NotFoundException('مسیر پیاده یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateWalkingRouteDto) {
    const { entryBorderCityId, originCountryIds, stages } =
      await this.validateRelated(dto);
    if (!entryBorderCityId || !originCountryIds || !stages) {
      throw new BadRequestException('اطلاعات مسیر ناقص است');
    }
    const created = await this.prisma.walkingRoute.create({
      data: {
        name: dto.name.trim(),
        distanceToMashhadKm: new Prisma.Decimal(dto.distanceToMashhadKm),
        entryBorderCityId,
        originCountries: {
          create: originCountryIds.map((countryId) => ({ countryId })),
        },
        stages: {
          create: stages.map((stage) => this.stageData(stage)),
        },
      },
      include: walkingRouteInclude,
    });
    return this.serialize(created);
  }

  async update(id: string, dto: UpdateWalkingRouteDto) {
    await this.findOne(id);
    const related = await this.validateRelated(dto, { partial: true });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.walkingRoute.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          distanceToMashhadKm:
            dto.distanceToMashhadKm === undefined
              ? undefined
              : new Prisma.Decimal(dto.distanceToMashhadKm),
          entryBorderCityId: related.entryBorderCityId,
        },
      });
      if (related.originCountryIds) {
        await tx.walkingRouteOriginCountry.deleteMany({
          where: { walkingRouteId: id },
        });
        await tx.walkingRouteOriginCountry.createMany({
          data: related.originCountryIds.map((countryId) => ({
            walkingRouteId: id,
            countryId,
          })),
        });
      }
      if (related.stages) {
        await tx.walkingRouteStage.deleteMany({
          where: { walkingRouteId: id },
        });
        await tx.walkingRouteStage.createMany({
          data: related.stages.map((stage) => ({
            walkingRouteId: id,
            ...this.stageData(stage),
          })),
        });
      }
      return tx.walkingRoute.findUniqueOrThrow({
        where: { id },
        include: walkingRouteInclude,
      });
    });
    return this.serialize(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.walkingRoute.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindWalkingRoutesQueryDto,
  ): Prisma.WalkingRouteWhereInput {
    const filters: Prisma.WalkingRouteWhereInput[] = [];
    if (query.originCountryId) {
      filters.push({
        originCountries: { some: { countryId: query.originCountryId } },
      });
    }
    if (query.cityId) {
      filters.push({ stages: { some: { cityId: query.cityId } } });
    } else if (query.provinceId) {
      filters.push({
        stages: { some: { city: { provinceId: query.provinceId } } },
      });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          {
            stages: {
              some: { description: containsInsensitive(query.q) },
            },
          },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async validateRelated(
    dto: CreateWalkingRouteDto | UpdateWalkingRouteDto,
    options?: { partial?: boolean },
  ) {
    const partial = options?.partial ?? false;
    const originCountryIds =
      dto.originCountryIds === undefined
        ? undefined
        : [...new Set(dto.originCountryIds)];
    const stages = dto.stages;

    if (!partial) {
      if (!originCountryIds?.length) {
        throw new BadRequestException('حداقل یک کشور مبدأ را انتخاب کنید');
      }
      if (!stages?.length) {
        throw new BadRequestException('حداقل یک مرحله برای مسیر لازم است');
      }
    }

    if (originCountryIds) {
      if (!originCountryIds.length) {
        throw new BadRequestException('حداقل یک کشور مبدأ را انتخاب کنید');
      }
      const countries = await this.prisma.country.findMany({
        where: { id: { in: originCountryIds } },
        select: { id: true },
      });
      if (countries.length !== originCountryIds.length) {
        throw new BadRequestException('کشور مبدأ انتخاب‌شده معتبر نیست');
      }
    }

    let entryBorderCityId = dto.entryBorderCityId;
    if (entryBorderCityId) {
      await this.assertIranianCity(entryBorderCityId, 'شهر مرز ورودی معتبر نیست');
    }

    if (stages) {
      if (!stages.length) {
        throw new BadRequestException('حداقل یک مرحله برای مسیر لازم است');
      }
      const numbers = stages.map((stage) => stage.stageNumber);
      if (new Set(numbers).size !== numbers.length) {
        throw new BadRequestException('شماره مرحله در مسیر تکراری است');
      }
      const cityIds = [...new Set(stages.map((stage) => stage.cityId))];
      const cities = await this.prisma.city.findMany({
        where: { id: { in: cityIds } },
        include: { province: { include: { country: true } } },
      });
      if (cities.length !== cityIds.length) {
        throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
      }
      for (const city of cities) {
        if (city.province.country.iso2 !== 'IR') {
          throw new BadRequestException(
            'مراحل مسیر فقط می‌توانند شهرهای ایران باشند',
          );
        }
      }
    }

    return { entryBorderCityId, originCountryIds, stages };
  }

  private async assertIranianCity(cityId: string, message: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: { province: { include: { country: true } } },
    });
    if (!city || city.province.country.iso2 !== 'IR') {
      throw new BadRequestException(message);
    }
  }

  private stageData(stage: WalkingRouteStageDto) {
    const decimal = (value: number | null | undefined) => {
      if (value === undefined || value == null) {
        return null;
      }
      return new Prisma.Decimal(value);
    };
    return {
      cityId: stage.cityId,
      stageNumber: stage.stageNumber,
      distanceToNextKm: decimal(stage.distanceToNextKm),
      distanceToPreviousKm: decimal(stage.distanceToPreviousKm),
      distanceToMashhadKm: decimal(stage.distanceToMashhadKm),
      description: stage.description?.trim() || null,
    };
  }

  private serialize(item: WalkingRouteRecord) {
    const num = (value: Prisma.Decimal | null) =>
      value == null ? null : Number(value);
    return {
      id: item.id,
      name: item.name,
      distanceToMashhadKm: Number(item.distanceToMashhadKm),
      entryBorderCityId: item.entryBorderCityId,
      entryBorderCity: item.entryBorderCity,
      originCountries: item.originCountries.map((row) => row.country),
      stages: item.stages.map((stage) => ({
        id: stage.id,
        cityId: stage.cityId,
        city: stage.city,
        stageNumber: stage.stageNumber,
        distanceToNextKm: num(stage.distanceToNextKm),
        distanceToPreviousKm: num(stage.distanceToPreviousKm),
        distanceToMashhadKm: num(stage.distanceToMashhadKm),
        description: stage.description,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
