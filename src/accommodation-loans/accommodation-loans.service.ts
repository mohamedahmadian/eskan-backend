import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { currentJalaliYear } from '../common/jalali-year';
import { parseIsoDate, parseOptionalIsoDate } from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupplierItemsService } from '../supplier-items/supplier-items.service';
import { CreateAccommodationLoanDto } from './dto/create-accommodation-loan.dto';
import { FindAccommodationLoansQueryDto } from './dto/find-accommodation-loans-query.dto';
import { UpdateAccommodationLoanDto } from './dto/update-accommodation-loan.dto';

const loanInclude = {
  supplierItem: {
    include: {
      supplier: { select: { id: true, name: true } },
    },
  },
  accommodationManager: {
    select: { id: true, fullName: true, username: true },
  },
} satisfies Prisma.AccommodationLoanInclude;

type LoanRecord = Prisma.AccommodationLoanGetPayload<{
  include: typeof loanInclude;
}>;

@Injectable()
export class AccommodationLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierItems: SupplierItemsService,
  ) {}

  async findAll(query: FindAccommodationLoansQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.accommodationLoan.findMany({
        where,
        orderBy,
        skip,
        take,
        include: loanInclude,
      }),
      this.prisma.accommodationLoan.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.withShortage(item)),
      total,
      page,
      pageSize,
    );
  }

  async findMine(query: FindAccommodationLoansQueryDto, actorId: string) {
    return this.findAll({ ...query, accommodationManagerId: actorId });
  }

  private listOrderBy(
    query: FindAccommodationLoansQueryDto,
  ): Prisma.AccommodationLoanOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.AccommodationLoanOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        item: (dir) => ({ supplierItem: { name: dir } }),
        manager: (dir) => ({ accommodationManager: { fullName: dir } }),
        supplier: (dir) => ({
          supplierItem: { supplier: { name: dir } },
        }),
        quantity: (dir) => ({ quantity: dir }),
        returnedQuantity: (dir) => ({ returnedQuantity: dir }),
        deliveryDate: (dir) => ({ deliveryDate: dir }),
      },
      [{ deliveryDate: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.accommodationLoan.findUnique({
      where: { id },
      include: loanInclude,
    });
    if (!item) {
      throw new NotFoundException('امانت یافت نشد');
    }
    return this.withShortage(item);
  }

  async findMineOne(id: string, actorId: string) {
    const item = await this.findOne(id);
    if (item.accommodationManagerId !== actorId) {
      throw new NotFoundException('امانت یافت نشد');
    }
    return item;
  }

  async report(year?: number) {
    const selectedYear = year ?? currentJalaliYear();
    const [items, loans] = await Promise.all([
      this.prisma.supplierItem.findMany({
        where: { year: selectedYear },
        select: {
          id: true,
          quantity: true,
          name: true,
          unit: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
      }),
      this.prisma.accommodationLoan.findMany({
        where: { supplierItem: { year: selectedYear } },
        select: {
          quantity: true,
          returnedQuantity: true,
          accommodationManagerId: true,
          accommodationManager: { select: { fullName: true } },
          supplierItemId: true,
          supplierItem: {
            select: {
              name: true,
              unit: true,
              supplierId: true,
              supplier: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const receivedFromSuppliers = items.reduce((sum, item) => sum + item.quantity, 0);
    const deliveredToManagers = loans.reduce((sum, loan) => sum + loan.quantity, 0);
    const returned = loans.reduce(
      (sum, loan) => sum + (loan.returnedQuantity ?? 0),
      0,
    );
    const unreturned = deliveredToManagers - returned;
    const warehouseRemaining = Math.max(
      0,
      receivedFromSuppliers - deliveredToManagers,
    );

    type SupplierRow = {
      supplierName: string;
      received: number;
      delivered: number;
      returned: number;
    };
    const supplierMap = new Map<string, SupplierRow>();
    for (const item of items) {
      const row = supplierMap.get(item.supplierId) ?? {
        supplierName: item.supplier.name,
        received: 0,
        delivered: 0,
        returned: 0,
      };
      row.received += item.quantity;
      supplierMap.set(item.supplierId, row);
    }
    for (const loan of loans) {
      const supplierId = loan.supplierItem.supplierId;
      const row = supplierMap.get(supplierId) ?? {
        supplierName: loan.supplierItem.supplier.name,
        received: 0,
        delivered: 0,
        returned: 0,
      };
      row.delivered += loan.quantity;
      row.returned += loan.returnedQuantity ?? 0;
      supplierMap.set(supplierId, row);
    }

    type ItemRow = {
      itemName: string;
      unit: string;
      received: number;
      delivered: number;
      returned: number;
    };
    const itemMap = new Map<string, ItemRow>();
    for (const item of items) {
      const key = item.name.trim();
      const row = itemMap.get(key) ?? {
        itemName: item.name.trim(),
        unit: item.unit,
        received: 0,
        delivered: 0,
        returned: 0,
      };
      row.received += item.quantity;
      itemMap.set(key, row);
    }
    for (const loan of loans) {
      const key = loan.supplierItem.name.trim();
      const row = itemMap.get(key) ?? {
        itemName: loan.supplierItem.name.trim(),
        unit: loan.supplierItem.unit,
        received: 0,
        delivered: 0,
        returned: 0,
      };
      row.delivered += loan.quantity;
      row.returned += loan.returnedQuantity ?? 0;
      itemMap.set(key, row);
    }

    type ManagerRow = {
      managerName: string;
      delivered: number;
      returned: number;
    };
    const managerMap = new Map<string, ManagerRow>();
    for (const loan of loans) {
      const row = managerMap.get(loan.accommodationManagerId) ?? {
        managerName: loan.accommodationManager.fullName,
        delivered: 0,
        returned: 0,
      };
      row.delivered += loan.quantity;
      row.returned += loan.returnedQuantity ?? 0;
      managerMap.set(loan.accommodationManagerId, row);
    }

    const movementByItemId = new Map<string, { delivered: number; returned: number }>();
    for (const loan of loans) {
      const row = movementByItemId.get(loan.supplierItemId) ?? {
        delivered: 0,
        returned: 0,
      };
      row.delivered += loan.quantity;
      row.returned += loan.returnedQuantity ?? 0;
      movementByItemId.set(loan.supplierItemId, row);
    }

    return {
      year: selectedYear,
      receivedFromSuppliers,
      deliveredToManagers,
      returned,
      unreturned,
      warehouseRemaining,
      itemStock: items
        .map((item) => {
          const movement = movementByItemId.get(item.id);
          const delivered = movement?.delivered ?? 0;
          const returnedCount = movement?.returned ?? 0;
          return {
            itemId: item.id,
            itemName: item.name,
            supplierName: item.supplier.name,
            quantity: item.quantity,
            unit: item.unit,
            delivered,
            returned: returnedCount,
            remaining: Math.max(0, item.quantity - delivered + returnedCount),
          };
        })
        .sort(
          (a, b) =>
            a.itemName.localeCompare(b.itemName, 'fa') ||
            a.supplierName.localeCompare(b.supplierName, 'fa'),
        ),
      byItem: [...itemMap.entries()]
        .map(([, row]) => ({
          itemName: row.itemName,
          unit: row.unit,
          received: row.received,
          delivered: row.delivered,
          returned: row.returned,
          unreturned: row.delivered - row.returned,
        }))
        .sort((a, b) => b.received - a.received || b.delivered - a.delivered),
      bySupplier: [...supplierMap.entries()]
        .map(([supplierId, row]) => ({
          supplierId,
          supplierName: row.supplierName,
          received: row.received,
          delivered: row.delivered,
          returned: row.returned,
          unreturned: row.delivered - row.returned,
        }))
        .sort((a, b) => b.received - a.received || b.delivered - a.delivered),
      byManager: [...managerMap.entries()]
        .map(([managerId, row]) => ({
          managerId,
          managerName: row.managerName,
          delivered: row.delivered,
          returned: row.returned,
          unreturned: row.delivered - row.returned,
        }))
        .sort((a, b) => b.delivered - a.delivered),
    };
  }

  async create(dto: CreateAccommodationLoanDto) {
    const item = await this.supplierItems.findOne(dto.supplierItemId);
    if (item.year !== currentJalaliYear()) {
      throw new BadRequestException(
        'فقط کالاهای امانی سال جاری را می‌توان به مدیران اسکان داد',
      );
    }
    await this.ensureManager(dto.accommodationManagerId);
    this.assertReturned(dto.quantity, dto.returnedQuantity);
    await this.assertStock(dto.supplierItemId, dto.quantity);
    const created = await this.prisma.accommodationLoan.create({
      data: this.toData(dto),
      include: loanInclude,
    });
    return this.withShortage(created);
  }

  async update(id: string, dto: UpdateAccommodationLoanDto) {
    const current = await this.findOne(id);
    const supplierItemId = dto.supplierItemId ?? current.supplierItemId;
    const quantity = dto.quantity ?? current.quantity;
    const returnedQuantity =
      dto.returnedQuantity === undefined
        ? current.returnedQuantity
        : dto.returnedQuantity;
    if (supplierItemId !== current.supplierItemId) {
      const item = await this.supplierItems.findOne(supplierItemId);
      if (item.year !== currentJalaliYear()) {
        throw new BadRequestException(
          'فقط کالاهای امانی سال جاری را می‌توان به مدیران اسکان داد',
        );
      }
    }
    if (dto.accommodationManagerId) {
      await this.ensureManager(dto.accommodationManagerId);
    }
    this.assertReturned(quantity, returnedQuantity);
    await this.assertStock(supplierItemId, quantity, id);
    const updated = await this.prisma.accommodationLoan.update({
      where: { id },
      data: {
        supplierItemId: dto.supplierItemId,
        accommodationManagerId: dto.accommodationManagerId,
        quantity: dto.quantity,
        deliveryDate: dto.deliveryDate
          ? parseIsoDate(dto.deliveryDate)
          : undefined,
        plannedReturnDate: parseOptionalIsoDate(dto.plannedReturnDate),
        actualReturnDate: parseOptionalIsoDate(dto.actualReturnDate),
        returnedQuantity:
          dto.returnedQuantity === undefined ? undefined : dto.returnedQuantity,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: loanInclude,
    });
    return this.withShortage(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.accommodationLoan.delete({ where: { id } });
    return { ok: true };
  }

  private toData(dto: CreateAccommodationLoanDto) {
    return {
      supplierItemId: dto.supplierItemId,
      accommodationManagerId: dto.accommodationManagerId,
      quantity: dto.quantity,
      deliveryDate: parseIsoDate(dto.deliveryDate),
      plannedReturnDate: parseOptionalIsoDate(dto.plannedReturnDate) ?? null,
      actualReturnDate: parseOptionalIsoDate(dto.actualReturnDate) ?? null,
      returnedQuantity: dto.returnedQuantity ?? null,
      description: dto.description?.trim() || null,
    };
  }

  private assertReturned(quantity: number, returnedQuantity?: number | null) {
    if (returnedQuantity != null && returnedQuantity > quantity) {
      throw new BadRequestException(
        'تعداد برگشتی نمی‌تواند بیشتر از تعداد تحویلی باشد',
      );
    }
  }

  private async assertStock(
    supplierItemId: string,
    quantity: number,
    excludeLoanId?: string,
  ) {
    const item = await this.supplierItems.findOne(supplierItemId);
    const outstanding = await this.supplierItems.outstandingQuantity(
      supplierItemId,
      excludeLoanId,
    );
    const remaining = item.quantity - outstanding;
    if (quantity > remaining) {
      throw new BadRequestException(
        `تعداد درخواستی بیشتر از موجودی باقیمانده (${remaining}) است`,
      );
    }
  }

  private async ensureManager(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user) {
      throw new BadRequestException('مدیر اسکان انتخاب‌شده معتبر نیست');
    }
    const isManager = user.userRoles.some(
      (item) => item.role.code === 'ACCOMMODATION_MANAGER',
    );
    if (!isManager) {
      throw new BadRequestException('کاربر انتخاب‌شده مدیر اسکان نیست');
    }
  }

  private listWhere(
    query: FindAccommodationLoansQueryDto,
  ): Prisma.AccommodationLoanWhereInput {
    const filters: Prisma.AccommodationLoanWhereInput[] = [];
    if (query.accommodationManagerId) {
      filters.push({ accommodationManagerId: query.accommodationManagerId });
    }
    if (query.supplierItemId) {
      filters.push({ supplierItemId: query.supplierItemId });
    }
    if (query.year) {
      filters.push({ supplierItem: { year: query.year } });
    }
    if (query.status === 'open') {
      filters.push({ returnedQuantity: null });
    }
    if (query.status === 'returned') {
      filters.push({ returnedQuantity: { not: null } });
    }
    if (query.returnStatus === 'full') {
      filters.push({
        AND: [
          { returnedQuantity: { not: null } },
          {
            returnedQuantity: {
              equals: this.prisma.accommodationLoan.fields.quantity,
            },
          },
        ],
      });
    }
    if (query.returnStatus === 'partial') {
      filters.push({
        AND: [
          { returnedQuantity: { not: null } },
          { returnedQuantity: { gt: 0 } },
          {
            returnedQuantity: {
              lt: this.prisma.accommodationLoan.fields.quantity,
            },
          },
        ],
      });
    }
    if (query.returnStatus === 'none') {
      filters.push({
        OR: [{ returnedQuantity: null }, { returnedQuantity: 0 }],
      });
    }
    if (query.q) {
      filters.push({
        OR: [
          { description: containsInsensitive(query.q) },
          { supplierItem: { name: containsInsensitive(query.q) } },
          { supplierItem: { supplier: { name: containsInsensitive(query.q) } } },
          {
            accommodationManager: {
              OR: [
                { fullName: containsInsensitive(query.q) },
                { username: containsInsensitive(query.q) },
              ],
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

  private withShortage(item: LoanRecord) {
    return {
      ...item,
      shortage:
        item.returnedQuantity == null
          ? null
          : item.quantity - item.returnedQuantity,
    };
  }
}
