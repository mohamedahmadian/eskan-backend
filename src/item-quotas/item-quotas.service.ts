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
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemQuotaDto } from './dto/create-item-quota.dto';
import { FindItemQuotasQueryDto } from './dto/find-item-quotas-query.dto';
import { UpdateItemQuotaDto } from './dto/update-item-quota.dto';

const quotaInclude = {
  supplier: { select: { id: true, name: true, type: true, phone: true, address: true } },
} satisfies Prisma.ItemQuotaInclude;

type QuotaRecord = Prisma.ItemQuotaGetPayload<{
  include: typeof quotaInclude;
}>;

@Injectable()
export class ItemQuotasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindItemQuotasQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.itemQuota.findMany({
        where,
        orderBy,
        include: quotaInclude,
      });
      return this.withRemaining(items);
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.itemQuota.findMany({
        where,
        orderBy,
        skip,
        take,
        include: quotaInclude,
      }),
      this.prisma.itemQuota.count({ where }),
    ]);
    return paginatedResult(await this.withRemaining(items), total, page, pageSize);
  }

  private listOrderBy(
    query: FindItemQuotasQueryDto,
  ): Prisma.ItemQuotaOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ItemQuotaOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        year: (dir) => ({ year: dir }),
        quantity: (dir) => ({ quantity: dir }),
        supplier: (dir) => ({ supplier: { name: dir } }),
      },
      [{ year: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.itemQuota.findUnique({
      where: { id },
      include: quotaInclude,
    });
    if (!item) {
      throw new NotFoundException('سهمیه یافت نشد');
    }
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async create(dto: CreateItemQuotaDto) {
    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }
    const item = await this.prisma.itemQuota.create({
      data: {
        year: dto.year,
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        quantity: dto.quantity,
        supplierId: dto.supplierId ?? null,
        description: dto.description?.trim() || null,
      },
      include: quotaInclude,
    });
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async update(id: string, dto: UpdateItemQuotaDto) {
    const current = await this.findOne(id);
    const quantity = dto.quantity ?? current.quantity;
    const issued = current.quantity - current.remainingQuantity;
    if (quantity < issued) {
      throw new BadRequestException(
        'تعداد سهمیه نمی‌تواند کمتر از حواله‌های صادرشده باشد',
      );
    }
    if (dto.supplierId && dto.supplierId !== current.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }
    const item = await this.prisma.itemQuota.update({
      where: { id },
      data: {
        year: dto.year,
        name: dto.name?.trim(),
        unit: dto.unit?.trim(),
        quantity: dto.quantity,
        supplierId: dto.supplierId === undefined ? undefined : dto.supplierId,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: quotaInclude,
    });
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async remove(id: string) {
    await this.findOne(id);
    const voucherCount = await this.prisma.itemQuotaVoucher.count({
      where: { quotaId: id },
    });
    if (voucherCount) {
      throw new BadRequestException(
        'برای این سهمیه حواله صادر شده و قابل حذف نیست',
      );
    }
    await this.prisma.itemQuota.delete({ where: { id } });
    return { ok: true };
  }

  async issuedQuantity(quotaId: string, excludeVoucherId?: string) {
    const vouchers = await this.prisma.itemQuotaVoucher.findMany({
      where: {
        quotaId,
        ...(excludeVoucherId ? { id: { not: excludeVoucherId } } : {}),
      },
      select: { quantity: true },
    });
    return vouchers.reduce((sum, voucher) => sum + voucher.quantity, 0);
  }

  private async ensureSupplier(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException('تامین‌کننده انتخاب‌شده معتبر نیست');
    }
  }

  private listWhere(query: FindItemQuotasQueryDto): Prisma.ItemQuotaWhereInput {
    const filters: Prisma.ItemQuotaWhereInput[] = [];
    if (query.supplierId) {
      filters.push({ supplierId: query.supplierId });
    }
    if (query.year) {
      filters.push({ year: query.year });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { unit: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { supplier: { name: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async withRemaining(items: QuotaRecord[]) {
    if (!items.length) {
      return [];
    }
    const vouchers = await this.prisma.itemQuotaVoucher.findMany({
      where: { quotaId: { in: items.map((item) => item.id) } },
      select: { quotaId: true, quantity: true },
    });
    const issuedByQuota = new Map<string, number>();
    for (const voucher of vouchers) {
      issuedByQuota.set(
        voucher.quotaId,
        (issuedByQuota.get(voucher.quotaId) ?? 0) + voucher.quantity,
      );
    }
    return items.map((item) => ({
      ...item,
      remainingQuantity: item.quantity - (issuedByQuota.get(item.id) ?? 0),
    }));
  }
}
