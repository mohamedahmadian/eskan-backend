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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { FindSuppliersQueryDto } from './dto/find-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindSuppliersQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.supplier.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindSuppliersQueryDto,
  ): Prisma.SupplierOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.SupplierOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        type: (dir) => ({ type: dir }),
        contactPerson: (dir) => ({ contactPerson: dir }),
        phone: (dir) => ({ phone: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.supplier.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('تامین‌کننده یافت نشد');
    }
    return item;
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        address: dto.address?.trim() || null,
        phone: dto.phone?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        contactPerson:
          dto.contactPerson === undefined
            ? undefined
            : dto.contactPerson?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const itemCount = await this.prisma.supplierItem.count({
      where: { supplierId: id },
    });
    if (itemCount) {
      throw new BadRequestException(
        'ابتدا اقلام امانی این تامین‌کننده را حذف کنید',
      );
    }
    const quotaCount = await this.prisma.itemQuota.count({
      where: { supplierId: id },
    });
    if (quotaCount) {
      throw new BadRequestException(
        'ابتدا سهمیه‌های این تامین‌کننده را حذف یا اصلاح کنید',
      );
    }
    const voucherCount = await this.prisma.itemQuotaVoucher.count({
      where: { supplierId: id },
    });
    if (voucherCount) {
      throw new BadRequestException(
        'ابتدا حواله‌های این تامین‌کننده را حذف یا اصلاح کنید',
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindSuppliersQueryDto): Prisma.SupplierWhereInput {
    const filters: Prisma.SupplierWhereInput[] = [];
    if (query.type) {
      filters.push({ type: query.type });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { contactPerson: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }
}
