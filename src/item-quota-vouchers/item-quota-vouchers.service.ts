import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isoDateTehranDayRange } from '../common/iso-date';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  ITEM_QUOTA_VOUCHER_KIND,
  nextSequentialVoucherCode,
  voucherCodePrefix,
} from '../common/voucher-code';
import { Prisma } from '../generated/prisma/client';
import { ItemQuotasService } from '../item-quotas/item-quotas.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemQuotaVoucherDto } from './dto/create-item-quota-voucher.dto';
import { FindItemQuotaVoucherReportQueryDto } from './dto/find-item-quota-voucher-report-query.dto';
import { FindItemQuotaVouchersQueryDto } from './dto/find-item-quota-vouchers-query.dto';
import { UpdateItemQuotaVoucherDto } from './dto/update-item-quota-voucher.dto';

const voucherInclude = {
  quota: {
    select: { id: true, year: true, name: true, unit: true, quantity: true },
  },
  accommodationManager: {
    select: {
      id: true,
      fullName: true,
      username: true,
      firstName: true,
      lastName: true,
      gender: true,
      nationalId: true,
      phone: true,
    },
  },
  supplier: {
    select: { id: true, name: true, phone: true, address: true, type: true },
  },
} satisfies Prisma.ItemQuotaVoucherInclude;

@Injectable()
export class ItemQuotaVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotas: ItemQuotasService,
  ) {}

  async report(query: FindItemQuotaVoucherReportQueryDto) {
    const year = query.year ?? currentJalaliYear();
    const [quotas, vouchers] = await Promise.all([
      this.prisma.itemQuota.findMany({
        where: { year },
        select: {
          id: true,
          name: true,
          unit: true,
          quantity: true,
          supplier: { select: { name: true } },
        },
      }),
      this.prisma.itemQuotaVoucher.findMany({
        where: { quota: { year } },
        select: {
          quantity: true,
          issuedAt: true,
          supplierId: true,
          supplierName: true,
          accommodationManagerId: true,
          accommodationManager: { select: { fullName: true } },
          quotaId: true,
          quota: { select: { name: true, unit: true } },
        },
      }),
    ]);

    const quotaQuantity = quotas.reduce((sum, item) => sum + item.quantity, 0);
    const issuedQuantity = vouchers.reduce((sum, item) => sum + item.quantity, 0);
    const remainingQuantity = Math.max(0, quotaQuantity - issuedQuantity);

    const issuedByQuota = new Map<
      string,
      { quantity: number; voucherCount: number }
    >();
    for (const voucher of vouchers) {
      const row = issuedByQuota.get(voucher.quotaId) ?? {
        quantity: 0,
        voucherCount: 0,
      };
      row.quantity += voucher.quantity;
      row.voucherCount += 1;
      issuedByQuota.set(voucher.quotaId, row);
    }

    type ItemRow = {
      itemName: string;
      unit: string;
      quotaQuantity: number;
      issuedQuantity: number;
      voucherCount: number;
    };
    const itemMap = new Map<string, ItemRow>();
    for (const quota of quotas) {
      const key = `${quota.name.trim()}|${quota.unit}`;
      const row = itemMap.get(key) ?? {
        itemName: quota.name.trim(),
        unit: quota.unit,
        quotaQuantity: 0,
        issuedQuantity: 0,
        voucherCount: 0,
      };
      row.quotaQuantity += quota.quantity;
      itemMap.set(key, row);
    }
    for (const voucher of vouchers) {
      const key = `${voucher.quota.name.trim()}|${voucher.quota.unit}`;
      const row = itemMap.get(key) ?? {
        itemName: voucher.quota.name.trim(),
        unit: voucher.quota.unit,
        quotaQuantity: 0,
        issuedQuantity: 0,
        voucherCount: 0,
      };
      row.issuedQuantity += voucher.quantity;
      row.voucherCount += 1;
      itemMap.set(key, row);
    }

    type SupplierRow = {
      supplierId: string | null;
      supplierName: string;
      voucherCount: number;
      issuedQuantity: number;
    };
    const supplierMap = new Map<string, SupplierRow>();
    for (const voucher of vouchers) {
      const key = voucher.supplierId ?? voucher.supplierName.trim();
      const row = supplierMap.get(key) ?? {
        supplierId: voucher.supplierId,
        supplierName: voucher.supplierName.trim(),
        voucherCount: 0,
        issuedQuantity: 0,
      };
      row.voucherCount += 1;
      row.issuedQuantity += voucher.quantity;
      supplierMap.set(key, row);
    }

    type ManagerRow = {
      managerName: string;
      voucherCount: number;
      issuedQuantity: number;
    };
    const managerMap = new Map<string, ManagerRow>();
    for (const voucher of vouchers) {
      const row = managerMap.get(voucher.accommodationManagerId) ?? {
        managerName: voucher.accommodationManager.fullName,
        voucherCount: 0,
        issuedQuantity: 0,
      };
      row.voucherCount += 1;
      row.issuedQuantity += voucher.quantity;
      managerMap.set(voucher.accommodationManagerId, row);
    }

    const byDayMap = new Map<
      string,
      { date: string; voucherCount: number; issuedQuantity: number }
    >();
    for (const voucher of vouchers) {
      const date = this.tehranIsoDate(voucher.issuedAt);
      const row = byDayMap.get(date) ?? {
        date,
        voucherCount: 0,
        issuedQuantity: 0,
      };
      row.voucherCount += 1;
      row.issuedQuantity += voucher.quantity;
      byDayMap.set(date, row);
    }

    return {
      year,
      quotaCount: quotas.length,
      issuedCount: vouchers.length,
      quotaQuantity,
      issuedQuantity,
      remainingQuantity,
      managerCount: managerMap.size,
      supplierCount: supplierMap.size,
      byQuota: quotas
        .map((quota) => {
          const issued = issuedByQuota.get(quota.id) ?? {
            quantity: 0,
            voucherCount: 0,
          };
          return {
            quotaId: quota.id,
            itemName: quota.name,
            unit: quota.unit,
            supplierName: quota.supplier?.name ?? null,
            quotaQuantity: quota.quantity,
            issuedQuantity: issued.quantity,
            remainingQuantity: Math.max(0, quota.quantity - issued.quantity),
            voucherCount: issued.voucherCount,
          };
        })
        .sort(
          (a, b) =>
            b.issuedQuantity - a.issuedQuantity ||
            a.itemName.localeCompare(b.itemName, 'fa'),
        ),
      byItem: [...itemMap.values()]
        .map((row) => ({
          ...row,
          remainingQuantity: Math.max(0, row.quotaQuantity - row.issuedQuantity),
        }))
        .sort((a, b) => b.issuedQuantity - a.issuedQuantity || b.quotaQuantity - a.quotaQuantity),
      bySupplier: [...supplierMap.values()].sort(
        (a, b) => b.issuedQuantity - a.issuedQuantity || b.voucherCount - a.voucherCount,
      ),
      byManager: [...managerMap.entries()]
        .map(([managerId, row]) => ({ managerId, ...row }))
        .sort(
          (a, b) =>
            b.issuedQuantity - a.issuedQuantity || b.voucherCount - a.voucherCount,
        ),
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async findAll(query: FindItemQuotaVouchersQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.itemQuotaVoucher.findMany({
        where,
        orderBy,
        skip,
        take,
        include: voucherInclude,
      }),
      this.prisma.itemQuotaVoucher.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findMine(query: FindItemQuotaVouchersQueryDto, actorId: string) {
    return this.findAll({ ...query, accommodationManagerId: actorId });
  }

  private listOrderBy(
    query: FindItemQuotaVouchersQueryDto,
  ): Prisma.ItemQuotaVoucherOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ItemQuotaVoucherOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        code: (dir) => ({ code: dir }),
        item: (dir) => ({ quota: { name: dir } }),
        manager: (dir) => ({ accommodationManager: { fullName: dir } }),
        quantity: (dir) => ({ quantity: dir }),
        supplier: (dir) => ({ supplierName: dir }),
        issuedAt: (dir) => ({ issuedAt: dir }),
      },
      [{ issuedAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.itemQuotaVoucher.findUnique({
      where: { id },
      include: voucherInclude,
    });
    if (!item) {
      throw new NotFoundException('حواله یافت نشد');
    }
    return item;
  }

  async findMineOne(id: string, actorId: string) {
    const item = await this.findOne(id);
    if (item.accommodationManagerId !== actorId) {
      throw new NotFoundException('حواله یافت نشد');
    }
    return item;
  }

  async findByCode(code: string) {
    const item = await this.prisma.itemQuotaVoucher.findUnique({
      where: { code: code.trim() },
      include: voucherInclude,
    });
    if (!item) {
      throw new NotFoundException('حواله یافت نشد');
    }
    return item;
  }

  async create(dto: CreateItemQuotaVoucherDto) {
    const quota = await this.quotas.findOne(dto.quotaId);
    await this.ensureManager(dto.accommodationManagerId);
    await this.assertStock(dto.quotaId, dto.quantity);
    const supplier = await this.resolveSupplier(dto);
    return this.createWithSequentialCode(quota.year, {
      quotaId: dto.quotaId,
      accommodationManagerId: dto.accommodationManagerId,
      quantity: dto.quantity,
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      pickupLocation: supplier.pickupLocation,
      description: dto.description?.trim() || null,
    });
  }

  async update(id: string, dto: UpdateItemQuotaVoucherDto) {
    const current = await this.findOne(id);
    const quotaId = dto.quotaId ?? current.quotaId;
    const quantity = dto.quantity ?? current.quantity;
    if (quotaId !== current.quotaId) {
      await this.quotas.findOne(quotaId);
    }
    if (dto.accommodationManagerId) {
      await this.ensureManager(dto.accommodationManagerId);
    }
    await this.assertStock(quotaId, quantity, id);
    const supplierChanged =
      dto.supplierId !== undefined ||
      dto.supplierName !== undefined ||
      dto.pickupLocation !== undefined;
    const supplier = supplierChanged
      ? await this.resolveSupplier({
          supplierId:
            dto.supplierId === undefined ? current.supplierId : dto.supplierId,
          supplierName:
            dto.supplierName === undefined
              ? current.supplierName
              : dto.supplierName,
          pickupLocation:
            dto.pickupLocation === undefined
              ? current.pickupLocation
              : dto.pickupLocation,
        })
      : null;
    return this.prisma.itemQuotaVoucher.update({
      where: { id },
      data: {
        quotaId: dto.quotaId,
        accommodationManagerId: dto.accommodationManagerId,
        quantity: dto.quantity,
        ...(supplier
          ? {
              supplierId: supplier.supplierId,
              supplierName: supplier.supplierName,
              pickupLocation: supplier.pickupLocation,
            }
          : {}),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: voucherInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.itemQuotaVoucher.delete({ where: { id } });
    return { ok: true };
  }

  private async resolveSupplier(dto: {
    supplierId?: string | null;
    supplierName?: string | null;
    pickupLocation?: string | null;
  }) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
        select: { id: true, name: true, address: true },
      });
      if (!supplier) {
        throw new BadRequestException('تامین‌کننده انتخاب‌شده معتبر نیست');
      }
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        pickupLocation: dto.pickupLocation?.trim() || supplier.address || null,
      };
    }
    const supplierName = dto.supplierName?.trim() || '';
    if (!supplierName) {
      throw new BadRequestException('نام تامین‌کننده را انتخاب یا وارد کنید');
    }
    return {
      supplierId: null,
      supplierName,
      pickupLocation: dto.pickupLocation?.trim() || null,
    };
  }

  private async assertStock(
    quotaId: string,
    quantity: number,
    excludeVoucherId?: string,
  ) {
    const quota = await this.quotas.findOne(quotaId);
    const issued = await this.quotas.issuedQuantity(quotaId, excludeVoucherId);
    const remaining = quota.quantity - issued;
    if (quantity > remaining) {
      throw new BadRequestException(
        `تعداد درخواستی بیشتر از باقیمانده سهمیه (${remaining}) است`,
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

  private async createWithSequentialCode(
    year: number,
    data: Omit<Prisma.ItemQuotaVoucherUncheckedCreateInput, 'code'>,
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.prisma.itemQuotaVoucher.create({
          data: {
            ...data,
            code: await this.nextSequentialCode(year),
          },
          include: voucherInclude,
        });
      } catch (error) {
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!conflict || attempt === 7) {
          throw error;
        }
      }
    }
    throw new BadRequestException('امکان صدور کد یکتای حواله نبود');
  }

  private async nextSequentialCode(year: number) {
    const prefix = voucherCodePrefix(year, ITEM_QUOTA_VOUCHER_KIND);
    const items = await this.prisma.itemQuotaVoucher.findMany({
      where: { quota: { year }, code: { startsWith: prefix } },
      select: { code: true },
    });
    return nextSequentialVoucherCode(
      year,
      ITEM_QUOTA_VOUCHER_KIND,
      items.map((item) => item.code),
    );
  }

  private listWhere(
    query: FindItemQuotaVouchersQueryDto,
  ): Prisma.ItemQuotaVoucherWhereInput {
    const filters: Prisma.ItemQuotaVoucherWhereInput[] = [];
    if (query.quotaId) {
      filters.push({ quotaId: query.quotaId });
    }
    if (query.accommodationManagerId) {
      filters.push({ accommodationManagerId: query.accommodationManagerId });
    }
    if (query.year) {
      filters.push({ quota: { year: query.year } });
    }
    if (query.supplierId) {
      filters.push({ supplierId: query.supplierId });
    }
    if (query.issuedAt) {
      filters.push({ issuedAt: isoDateTehranDayRange(query.issuedAt) });
    }
    if (query.q) {
      filters.push({
        OR: [
          { code: containsInsensitive(query.q) },
          { supplierName: containsInsensitive(query.q) },
          { pickupLocation: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { quota: { name: containsInsensitive(query.q) } },
          {
            accommodationManager: {
              OR: [
                { fullName: containsInsensitive(query.q) },
                { username: containsInsensitive(query.q) },
                { nationalId: containsInsensitive(query.q) },
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

  private tehranIsoDate(value: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
}
