import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { toNumber, unitsAreCompatible } from '../common/nutrition-units';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { FindIngredientsQueryDto } from './dto/find-ingredients-query.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

const ingredientInclude = {
  _count: { select: { recipes: true } },
} satisfies Prisma.IngredientInclude;

type IngredientRecord = Prisma.IngredientGetPayload<{
  include: typeof ingredientInclude;
}>;

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindIngredientsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.ingredient.findMany({
        where,
        orderBy,
        include: ingredientInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.ingredient.findMany({
        where,
        orderBy,
        skip,
        take,
        include: ingredientInclude,
      }),
      this.prisma.ingredient.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.ingredient.findUnique({
      where: { id },
      include: ingredientInclude,
    });
    if (!item) {
      throw new NotFoundException('ماده اولیه یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateIngredientDto) {
    const item = await this.prisma.ingredient.create({
      data: {
        name: dto.name.trim(),
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        stockQty: dto.stockQty,
        description: dto.description?.trim() || null,
      },
      include: ingredientInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const current = await this.findOne(id);
    if (
      dto.unit &&
      current.foodsCount > 0 &&
      !unitsAreCompatible(dto.unit, current.unit)
    ) {
      throw new BadRequestException(
        'واحد این ماده در غذاها استفاده شده و فقط به واحد هم‌جنس قابل تغییر است',
      );
    }
    const item = await this.prisma.ingredient.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        stockQty: dto.stockQty,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: ingredientInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    if (item.foodsCount > 0) {
      throw new BadRequestException(
        'این ماده در ترکیب غذاها استفاده شده و قابل حذف نیست',
      );
    }
    await this.prisma.ingredient.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindIngredientsQueryDto): Prisma.IngredientWhereInput {
    const filters: Prisma.IngredientWhereInput[] = [];
    if (query.unit) {
      filters.push({ unit: query.unit });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindIngredientsQueryDto,
  ): Prisma.IngredientOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.IngredientOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        unit: (dir) => ({ unit: dir }),
        pricePerUnit: (dir) => ({ pricePerUnit: dir }),
        stockQty: (dir) => ({ stockQty: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private serialize(item: IngredientRecord) {
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      pricePerUnit: toNumber(item.pricePerUnit),
      stockQty: toNumber(item.stockQty),
      description: item.description,
      foodsCount: item._count.recipes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
