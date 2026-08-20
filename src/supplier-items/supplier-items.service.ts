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
import { parseIsoDate, parseOptionalIsoDate } from '../common/iso-date';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierItemDto } from './dto/create-supplier-item.dto';
import { FindSupplierItemsQueryDto } from './dto/find-supplier-items-query.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-item.dto';

const supplierItemInclude = {
  supplier: { select: { id: true, name: true, type: true } },
} satisfies Prisma.SupplierItemInclude;

type SupplierItemRecord = Prisma.SupplierItemGetPayload<{
  include: typeof supplierItemInclude;
}>;

@Injectable()
export class SupplierItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindSupplierItemsQueryDto) {
    const where = this.listWhere(query);
    const orderBy: Prisma.SupplierItemOrderByWithRelationInput[] = [
      { year: 'desc' },
      { createdAt: 'desc' },
    ];
    if (!wantsPagination(query)) {
      const items = await this.prisma.supplierItem.findMany({
        where,
        orderBy,
        include: supplierItemInclude,
      });
      const mapped = await this.withRemaining(items);
      return query.availableOnly
        ? mapped.filter((item) => item.remainingQuantity > 0)
        : mapped;
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.supplierItem.findMany({
        where,
        orderBy,
        skip,
        take,
        include: supplierItemInclude,
      }),
      this.prisma.supplierItem.count({ where }),
    ]);
    return paginatedResult(await this.withRemaining(items), total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.supplierItem.findUnique({
      where: { id },
      include: supplierItemInclude,
    });
    if (!item) {
      throw new NotFoundException('کالای امانی یافت نشد');
    }
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async create(dto: CreateSupplierItemDto) {
    await this.ensureSupplier(dto.supplierId);
    const item = await this.prisma.supplierItem.create({
      data: {
        supplierId: dto.supplierId,
        year: dto.year,
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        quantity: dto.quantity,
        deliveryDate: parseIsoDate(dto.deliveryDate),
        returnDate: parseOptionalIsoDate(dto.returnDate) ?? null,
        description: dto.description?.trim() || null,
      },
      include: supplierItemInclude,
    });
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async update(id: string, dto: UpdateSupplierItemDto) {
    const current = await this.findOne(id);
    const quantity = dto.quantity ?? current.quantity;
    const outstanding = current.quantity - current.remainingQuantity;
    if (quantity < outstanding) {
      throw new BadRequestException(
        'تعداد کالا نمی‌تواند کمتر از امانت‌های تحویل‌شده به مدیران اسکان باشد',
      );
    }
    if (dto.supplierId && dto.supplierId !== current.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }
    const item = await this.prisma.supplierItem.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        year: dto.year,
        name: dto.name?.trim(),
        unit: dto.unit?.trim(),
        quantity: dto.quantity,
        deliveryDate: dto.deliveryDate
          ? parseIsoDate(dto.deliveryDate)
          : undefined,
        returnDate: parseOptionalIsoDate(dto.returnDate),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: supplierItemInclude,
    });
    const [mapped] = await this.withRemaining([item]);
    return mapped;
  }

  async remove(id: string) {
    await this.findOne(id);
    const loanCount = await this.prisma.accommodationLoan.count({
      where: { supplierItemId: id },
    });
    if (loanCount) {
      throw new BadRequestException(
        'این کالا به مدیران اسکان امانت داده شده و قابل حذف نیست',
      );
    }
    await this.prisma.supplierItem.delete({ where: { id } });
    return { ok: true };
  }

  async outstandingQuantity(itemId: string, excludeLoanId?: string) {
    const loans = await this.prisma.accommodationLoan.findMany({
      where: {
        supplierItemId: itemId,
        ...(excludeLoanId ? { id: { not: excludeLoanId } } : {}),
      },
      select: { quantity: true, returnedQuantity: true },
    });
    return loans.reduce(
      (sum, loan) => sum + loan.quantity - (loan.returnedQuantity ?? 0),
      0,
    );
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

  private listWhere(
    query: FindSupplierItemsQueryDto,
  ): Prisma.SupplierItemWhereInput {
    const filters: Prisma.SupplierItemWhereInput[] = [];
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
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async withRemaining(items: SupplierItemRecord[]) {
    if (!items.length) {
      return [];
    }
    const loans = await this.prisma.accommodationLoan.findMany({
      where: { supplierItemId: { in: items.map((item) => item.id) } },
      select: {
        supplierItemId: true,
        quantity: true,
        returnedQuantity: true,
      },
    });
    const outstandingByItem = new Map<string, number>();
    for (const loan of loans) {
      const current = outstandingByItem.get(loan.supplierItemId) ?? 0;
      outstandingByItem.set(
        loan.supplierItemId,
        current + loan.quantity - (loan.returnedQuantity ?? 0),
      );
    }
    return items.map((item) => ({
      ...item,
      remainingQuantity: item.quantity - (outstandingByItem.get(item.id) ?? 0),
    }));
  }
}
