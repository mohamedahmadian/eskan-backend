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
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodSupplierDto } from './dto/create-food-supplier.dto';
import { FindFoodSuppliersQueryDto } from './dto/find-food-suppliers-query.dto';
import { UpdateFoodSupplierDto } from './dto/update-food-supplier.dto';

const geoSelect = { id: true, nameFa: true, nameEn: true };

const foodSupplierInclude = {
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
} satisfies Prisma.FoodSupplierInclude;

@Injectable()
export class FoodSuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindFoodSuppliersQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.foodSupplier.findMany({
        where,
        orderBy,
        skip,
        take,
        include: foodSupplierInclude,
      }),
      this.prisma.foodSupplier.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindFoodSuppliersQueryDto,
  ): Prisma.FoodSupplierOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.FoodSupplierOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        phone: (dir) => ({ phone: dir }),
        province: (dir) => ({ province: { nameFa: dir } }),
        city: (dir) => ({ city: { nameFa: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.foodSupplier.findUnique({
      where: { id },
      include: foodSupplierInclude,
    });
    if (!item) {
      throw new NotFoundException('تامین‌کننده غذا یافت نشد');
    }
    return item;
  }

  async create(dto: CreateFoodSupplierDto) {
    const geo = await this.resolveGeo(dto.provinceId, dto.cityId);
    return this.prisma.foodSupplier.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        description: dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: foodSupplierInclude,
    });
  }

  async update(id: string, dto: UpdateFoodSupplierDto) {
    const current = await this.findOne(id);
    const provinceId = dto.provinceId ?? current.provinceId;
    const cityId = dto.cityId ?? current.cityId;
    const geo = await this.resolveGeo(provinceId, cityId);
    return this.prisma.foodSupplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        provinceId: geo.provinceId,
        cityId: geo.cityId,
      },
      include: foodSupplierInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.foodSupplier.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindFoodSuppliersQueryDto,
  ): Prisma.FoodSupplierWhereInput {
    const filters: Prisma.FoodSupplierWhereInput[] = [];
    if (query.cityId) {
      filters.push({ cityId: query.cityId });
    } else if (query.provinceId) {
      filters.push({ provinceId: query.provinceId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async resolveGeo(provinceId: string, cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, provinceId: true },
    });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (city.provinceId !== provinceId) {
      throw new BadRequestException('شهر انتخاب‌شده متعلق به این استان نیست');
    }
    return { provinceId: city.provinceId, cityId: city.id };
  }
}
