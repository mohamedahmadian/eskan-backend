import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { FindRestaurantsQueryDto } from './dto/find-restaurants-query.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindRestaurantsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.restaurant.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.restaurant.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindRestaurantsQueryDto,
  ): Prisma.RestaurantOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.RestaurantOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        managerName: (dir) => ({ managerName: dir }),
        managerPhone: (dir) => ({ managerPhone: dir }),
        address: (dir) => ({ address: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('رستوران یافت نشد');
    }
    return item;
  }

  create(dto: CreateRestaurantDto) {
    return this.prisma.restaurant.create({
      data: {
        name: dto.name.trim(),
        managerName: dto.managerName?.trim() || null,
        managerPhone: dto.managerPhone?.trim() || null,
        address: dto.address?.trim() || null,
        neshanAddress: dto.neshanAddress?.trim() || null,
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateRestaurantDto) {
    await this.findOne(id);
    return this.prisma.restaurant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        managerName:
          dto.managerName === undefined
            ? undefined
            : dto.managerName?.trim() || null,
        managerPhone:
          dto.managerPhone === undefined
            ? undefined
            : dto.managerPhone?.trim() || null,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        neshanAddress:
          dto.neshanAddress === undefined
            ? undefined
            : dto.neshanAddress?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const mealPlanCount = await this.prisma.restaurantMealPlan.count({
      where: { restaurantId: id },
    });
    if (mealPlanCount) {
      throw new BadRequestException(
        'ابتدا برنامه‌های غذایی این رستوران را حذف کنید',
      );
    }
    await this.prisma.restaurant.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindRestaurantsQueryDto): Prisma.RestaurantWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { managerName: containsInsensitive(query.q) },
        { managerPhone: containsInsensitive(query.q) },
        { address: containsInsensitive(query.q) },
        { neshanAddress: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
      ],
    };
  }
}
