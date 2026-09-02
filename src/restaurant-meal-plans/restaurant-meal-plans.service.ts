import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { currentJalaliYear } from '../common/jalali-year';
import { parseIsoDate } from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { ManagementType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantMealPlanDistributionDto } from './dto/create-restaurant-meal-plan-distribution.dto';
import { CreateRestaurantMealPlanDto } from './dto/create-restaurant-meal-plan.dto';
import { FindRestaurantMealPlansQueryDto } from './dto/find-restaurant-meal-plans-query.dto';
import { UpdateRestaurantMealPlanDto } from './dto/update-restaurant-meal-plan.dto';

const DISTRIBUTION_MANAGEMENT_TYPES: ManagementType[] = [
  'NON_SELF_SUFFICIENT',
  'SEMI_SELF_SUFFICIENT',
];

function distributionInclude(year: number) {
  return {
    accommodation: {
      select: {
        id: true,
        name: true,
        managementType: true,
        managers: {
          where: { year, userId: { not: null } },
          orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
          select: {
            id: true,
            isPrimary: true,
            user: { select: { id: true, fullName: true, phone: true, nationalId: true } },
          },
        },
      },
    },
  } satisfies Prisma.RestaurantMealPlanDistributionInclude;
}

const mealPlanInclude = {
  restaurant: { select: { id: true, name: true, address: true, neshanAddress: true } },
  food: { select: { id: true, name: true } },
} satisfies Prisma.RestaurantMealPlanInclude;

type MealPlanRecord = Prisma.RestaurantMealPlanGetPayload<{
  include: typeof mealPlanInclude;
}>;

@Injectable()
export class RestaurantMealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindRestaurantMealPlansQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.restaurantMealPlan.findMany({
        where,
        orderBy,
        include: mealPlanInclude,
      });
      return this.withDistribution(items);
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.restaurantMealPlan.findMany({
        where,
        orderBy,
        skip,
        take,
        include: mealPlanInclude,
      }),
      this.prisma.restaurantMealPlan.count({ where }),
    ]);
    return paginatedResult(
      await this.withDistribution(items),
      total,
      page,
      pageSize,
    );
  }

  private listOrderBy(
    query: FindRestaurantMealPlansQueryDto,
  ): Prisma.RestaurantMealPlanOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.RestaurantMealPlanOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        planDate: (dir) => ({ planDate: dir }),
        restaurant: (dir) => ({ restaurant: { name: dir } }),
        food: (dir) => ({ food: { name: dir } }),
        mealType: (dir) => ({ mealType: dir }),
        servings: (dir) => ({ servings: dir }),
      },
      [{ planDate: 'desc' }, { mealType: 'asc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.restaurantMealPlan.findUnique({
      where: { id },
      include: mealPlanInclude,
    });
    if (!item) {
      throw new NotFoundException('برنامه غذایی یافت نشد');
    }
    const [mapped] = await this.withDistribution([item]);
    return mapped;
  }

  async create(dto: CreateRestaurantMealPlanDto) {
    await this.ensureRestaurant(dto.restaurantId);
    await this.ensureFood(dto.foodId);
    await this.ensureUniqueMeal(dto.restaurantId, dto.planDate, dto.mealType);
    try {
      const item = await this.prisma.restaurantMealPlan.create({
        data: {
          restaurantId: dto.restaurantId,
          foodId: dto.foodId,
          planDate: parseIsoDate(dto.planDate),
          mealType: dto.mealType,
          servings: dto.servings,
          description: dto.description?.trim() || null,
        },
        include: mealPlanInclude,
      });
      const [mapped] = await this.withDistribution([item]);
      return mapped;
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(id: string, dto: UpdateRestaurantMealPlanDto) {
    const current = await this.findOne(id);
    if (dto.restaurantId && dto.restaurantId !== current.restaurantId) {
      await this.ensureRestaurant(dto.restaurantId);
    }
    if (dto.foodId && dto.foodId !== current.foodId) {
      await this.ensureFood(dto.foodId);
    }
    await this.ensureUniqueMeal(
      dto.restaurantId ?? current.restaurantId,
      dto.planDate ?? current.planDate,
      dto.mealType ?? current.mealType,
      id,
    );
    if (dto.servings != null && dto.servings < current.distributedServings) {
      throw new BadRequestException(
        'تعداد پرس نمی‌تواند کمتر از پرس‌های توزیع‌شده باشد',
      );
    }
    try {
      const item = await this.prisma.restaurantMealPlan.update({
        where: { id },
        data: {
          restaurantId: dto.restaurantId,
          foodId: dto.foodId,
          planDate: dto.planDate ? parseIsoDate(dto.planDate) : undefined,
          mealType: dto.mealType,
          servings: dto.servings,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
        },
        include: mealPlanInclude,
      });
      const [mapped] = await this.withDistribution([item]);
      return mapped;
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const distributionCount = await this.prisma.restaurantMealPlanDistribution.count({
      where: { mealPlanId: id },
    });
    if (distributionCount) {
      throw new BadRequestException(
        'برای این وعده توزیع ثبت شده و قابل حذف نیست',
      );
    }
    await this.prisma.restaurantMealPlan.delete({ where: { id } });
    return { ok: true };
  }

  async findDistributions(id: string) {
    const mealPlan = await this.findOne(id);
    const items = await this.prisma.restaurantMealPlanDistribution.findMany({
      where: { mealPlanId: id },
      include: distributionInclude(currentJalaliYear()),
      orderBy: { createdAt: 'asc' },
    });
    return {
      mealPlan,
      items,
      totalServings: mealPlan.servings,
      distributedServings: mealPlan.distributedServings,
      remainingServings: mealPlan.remainingServings,
    };
  }

  async findDistributionAccommodations(id: string) {
    await this.findOne(id);
    const assigned = await this.prisma.restaurantMealPlanDistribution.findMany({
      where: { mealPlanId: id },
      select: { accommodationId: true },
    });
    const assignedIds = assigned.map((row) => row.accommodationId);
    return this.prisma.accommodation.findMany({
      where: {
        status: { not: 'INACTIVE' },
        managementType: { in: DISTRIBUTION_MANAGEMENT_TYPES },
        ...(assignedIds.length ? { id: { notIn: assignedIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        managementType: true,
        maleCapacity: true,
        femaleCapacity: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDistribution(
    id: string,
    dto: CreateRestaurantMealPlanDistributionDto,
  ) {
    const mealPlan = await this.findOne(id);
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id: dto.accommodationId },
      select: { id: true, status: true, managementType: true },
    });
    if (!accommodation || accommodation.status === 'INACTIVE') {
      throw new BadRequestException('اسکان انتخاب‌شده معتبر نیست');
    }
    if (!DISTRIBUTION_MANAGEMENT_TYPES.includes(accommodation.managementType)) {
      throw new BadRequestException(
        'فقط اسکان غیرخودکفا یا نیمه‌خودکفا قابل انتخاب است',
      );
    }
    if (dto.servings > mealPlan.remainingServings) {
      throw new BadRequestException(
        `تعداد درخواستی بیشتر از پرس باقیمانده (${mealPlan.remainingServings}) است`,
      );
    }
    try {
      await this.prisma.restaurantMealPlanDistribution.create({
        data: {
          mealPlanId: id,
          accommodationId: dto.accommodationId,
          servings: dto.servings,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('این اسکان قبلاً به این وعده اضافه شده است');
      }
      throw error;
    }
    return this.findDistributions(id);
  }

  async removeDistribution(id: string, distributionId: string) {
    const item = await this.prisma.restaurantMealPlanDistribution.findFirst({
      where: { id: distributionId, mealPlanId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('توزیع یافت نشد');
    }
    await this.prisma.restaurantMealPlanDistribution.delete({
      where: { id: distributionId },
    });
    return { ok: true };
  }

  private listWhere(
    query: FindRestaurantMealPlansQueryDto,
  ): Prisma.RestaurantMealPlanWhereInput {
    const filters: Prisma.RestaurantMealPlanWhereInput[] = [];
    if (query.restaurantId) {
      filters.push({ restaurantId: query.restaurantId });
    }
    if (query.foodId) {
      filters.push({ foodId: query.foodId });
    }
    if (query.planDate) {
      filters.push({ planDate: parseIsoDate(query.planDate) });
    }
    if (query.mealType) {
      filters.push({ mealType: query.mealType });
    }
    if (query.q) {
      filters.push({
        OR: [
          { description: containsInsensitive(query.q) },
          { restaurant: { name: containsInsensitive(query.q) } },
          { food: { name: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async ensureRestaurant(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new BadRequestException('رستوران انتخاب‌شده معتبر نیست');
    }
  }

  private async ensureUniqueMeal(
    restaurantId: string,
    planDate: string,
    mealType: CreateRestaurantMealPlanDto['mealType'],
    exceptId?: string,
  ) {
    const existing = await this.prisma.restaurantMealPlan.findFirst({
      where: {
        restaurantId,
        planDate: parseIsoDate(planDate),
        mealType,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'این وعده برای این رستوران در این تاریخ قبلاً ثبت شده است',
      );
    }
  }

  private async ensureFood(foodId: string) {
    const food = await this.prisma.food.findUnique({
      where: { id: foodId },
      select: { id: true },
    });
    if (!food) {
      throw new BadRequestException('غذای انتخاب‌شده معتبر نیست');
    }
  }

  private async withDistribution(items: MealPlanRecord[]) {
    if (!items.length) {
      return [];
    }
    const grouped = await this.prisma.restaurantMealPlanDistribution.groupBy({
      by: ['mealPlanId'],
      where: { mealPlanId: { in: items.map((item) => item.id) } },
      _sum: { servings: true },
    });
    const totals = new Map(
      grouped.map((row) => [row.mealPlanId, row._sum.servings ?? 0]),
    );
    return items.map((item) => {
      const distributedServings = totals.get(item.id) ?? 0;
      return {
        ...this.serialize(item),
        distributedServings,
        remainingServings: item.servings - distributedServings,
      };
    });
  }

  private serialize(item: MealPlanRecord) {
    return {
      ...item,
      planDate:
        item.planDate instanceof Date
          ? item.planDate.toISOString().slice(0, 10)
          : String(item.planDate).slice(0, 10),
    };
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'این وعده برای این رستوران در این تاریخ قبلاً ثبت شده است',
      );
    }
    throw error;
  }
}
