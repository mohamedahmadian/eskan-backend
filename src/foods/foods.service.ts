import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  convertQuantity,
  lineCost,
  toNumber,
  unitsAreCompatible,
} from '../common/nutrition-units';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodDto, FoodIngredientLineDto } from './dto/create-food.dto';
import { FindFoodsQueryDto } from './dto/find-foods-query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';

const foodInclude = {
  ingredients: {
    include: {
      ingredient: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.FoodInclude;

type FoodRecord = Prisma.FoodGetPayload<{ include: typeof foodInclude }>;

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindFoodsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.food.findMany({
        where,
        orderBy,
        include: foodInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        orderBy,
        skip,
        take,
        include: foodInclude,
      }),
      this.prisma.food.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.food.findUnique({
      where: { id },
      include: foodInclude,
    });
    if (!item) {
      throw new NotFoundException('غذا یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateFoodDto) {
    const lines = await this.resolveLines(dto.ingredients);
    const item = await this.prisma.food.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        finalPrice: dto.finalPrice,
        ingredients: {
          create: lines.map((line) => ({
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            unit: line.unit,
          })),
        },
      },
      include: foodInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateFoodDto) {
    await this.findOne(id);
    const lines =
      dto.ingredients === undefined
        ? undefined
        : await this.resolveLines(dto.ingredients);
    const item = await this.prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.foodIngredient.deleteMany({ where: { foodId: id } });
      }
      return tx.food.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          finalPrice: dto.finalPrice,
          ...(lines
            ? {
                ingredients: {
                  create: lines.map((line) => ({
                    ingredientId: line.ingredientId,
                    quantity: line.quantity,
                    unit: line.unit,
                  })),
                },
              }
            : {}),
        },
        include: foodInclude,
      });
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    const mealPlanCount = await this.prisma.restaurantMealPlan.count({
      where: { foodId: id },
    });
    if (mealPlanCount) {
      throw new BadRequestException(
        'ابتدا برنامه‌های غذایی وابسته به این غذا را حذف کنید',
      );
    }
    await this.prisma.food.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindFoodsQueryDto): Prisma.FoodWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        {
          ingredients: {
            some: { ingredient: { name: containsInsensitive(query.q) } },
          },
        },
      ],
    };
  }

  private listOrderBy(
    query: FindFoodsQueryDto,
  ): Prisma.FoodOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.FoodOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        finalPrice: (dir) => ({ finalPrice: dir }),
        ingredientsCount: (dir) => ({ ingredients: { _count: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private async resolveLines(lines: FoodIngredientLineDto[]) {
    const ids = lines.map((line) => line.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('هر ماده اولیه فقط یک‌بار در غذا مجاز است');
    }
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(ingredients.map((item) => [item.id, item]));
    return lines.map((line) => {
      const ingredient = byId.get(line.ingredientId);
      if (!ingredient) {
        throw new BadRequestException('ماده اولیه انتخاب‌شده معتبر نیست');
      }
      if (!unitsAreCompatible(line.unit, ingredient.unit)) {
        throw new BadRequestException(
          `واحد مقدار «${ingredient.name}» با واحد ماده سازگار نیست`,
        );
      }
      return {
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unit: line.unit,
      };
    });
  }

  private serialize(item: FoodRecord) {
    const ingredients = item.ingredients.map((line) => {
      const quantity = toNumber(line.quantity);
      const pricePerUnit = toNumber(line.ingredient.pricePerUnit);
      const stockQty = toNumber(line.ingredient.stockQty);
      const cost = lineCost(
        quantity,
        line.unit,
        pricePerUnit,
        line.ingredient.unit,
      );
      const qtyInIngredientUnit = convertQuantity(
        quantity,
        line.unit,
        line.ingredient.unit,
      );
      return {
        id: line.id,
        foodId: line.foodId,
        ingredientId: line.ingredientId,
        quantity,
        unit: line.unit,
        cost,
        qtyInIngredientUnit,
        ingredient: {
          id: line.ingredient.id,
          name: line.ingredient.name,
          unit: line.ingredient.unit,
          pricePerUnit,
          stockQty,
          description: line.ingredient.description,
        },
      };
    });
    const costPrice = ingredients.reduce((sum, line) => sum + line.cost, 0);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      finalPrice: toNumber(item.finalPrice),
      costPrice: Math.round(costPrice * 100) / 100,
      ingredientsCount: ingredients.length,
      ingredients,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
