import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import { parseIsoDate, parseOptionalIsoDate } from '../common/iso-date';
import { currentJalaliYear } from '../common/jalali-year';
import {
  ICE_VOUCHER_KIND,
  nextSequentialVoucherCode,
  voucherCodePrefix,
} from '../common/voucher-code';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { IceVoucherPaymentStatus, IceVoucherStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { CreateIceVoucherDto } from './dto/create-ice-voucher.dto';
import { FindIceVoucherReportQueryDto } from './dto/find-ice-voucher-report-query.dto';
import { FindIceVouchersQueryDto } from './dto/find-ice-vouchers-query.dto';
import { UpdateIceVoucherSettingsDto } from './dto/update-ice-voucher-settings.dto';

const SETTINGS_ID = 'default';

type Actor = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

const voucherInclude = {
  accommodation: {
    select: {
      id: true,
      name: true,
      maleCapacity: true,
      femaleCapacity: true,
    },
  },
  accommodationManager: {
    select: {
      id: true,
      fullName: true,
      username: true,
      phone: true,
    },
  },
  approvedBy: {
    select: { id: true, fullName: true, username: true },
  },
} satisfies Prisma.IceVoucherInclude;

type IceVoucherRecord = Prisma.IceVoucherGetPayload<{
  include: typeof voucherInclude;
}>;

@Injectable()
export class IceVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async getSettings() {
    return this.serializeSettings(await this.ensureSettings());
  }

  async updateSettings(dto: UpdateIceVoucherSettingsDto) {
    await this.ensureSettings();
    const activityStartDate = parseOptionalIsoDate(dto.activityStartDate) ?? null;
    const activityEndDate = parseOptionalIsoDate(dto.activityEndDate) ?? null;
    this.assertActivityRange(activityStartDate, activityEndDate);
    return this.serializeSettings(
      await this.prisma.iceVoucherSettings.update({
        where: { id: SETTINGS_ID },
        data: {
          moldsPer50Pilgrims: dto.moldsPer50Pilgrims,
          costPerMold: dto.costPerMold,
          activityStartDate,
          activityEndDate,
        },
      }),
    );
  }

  async quota(accommodationId: string, actor: Actor) {
    const accommodation = await this.requireAccommodation(accommodationId);
    await this.assertCanUseAccommodation(accommodationId, actor);
    const settings = await this.ensureSettings();
    const capacity = this.capacityOf(accommodation);
    const maxMoldCount = this.maxMoldCount(
      capacity,
      settings.moldsPer50Pilgrims,
    );
    return {
      accommodationId: accommodation.id,
      accommodationName: accommodation.name,
      capacity,
      moldsPer50Pilgrims: settings.moldsPer50Pilgrims,
      costPerMold: settings.costPerMold,
      maxMoldCount,
    };
  }

  async usableAccommodations(actor: Actor) {
    const year = currentJalaliYear();
    const where: Prisma.AccommodationWhereInput = isAdmin(actor)
      ? {}
      : { managers: { some: { userId: actor.id } } };
    const items = await this.prisma.accommodation.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        maleCapacity: true,
        femaleCapacity: true,
        managers: {
          where: { year },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            user: { select: { fullName: true } },
          },
        },
      },
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      maleCapacity: item.maleCapacity,
      femaleCapacity: item.femaleCapacity,
      managerName:
        item.managers
          .map((manager) => manager.user?.fullName?.trim())
          .filter((name): name is string => Boolean(name))
          .join('، ') || null,
    }));
  }

  async findAll(query: FindIceVouchersQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.iceVoucher.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: voucherInclude,
      }),
      this.prisma.iceVoucher.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findMine(query: FindIceVouchersQueryDto, actorId: string) {
    return this.findAll({ ...query, accommodationManagerId: actorId });
  }

  async stats(query: FindIceVoucherReportQueryDto, actorId?: string) {
    const year = query.year ?? currentJalaliYear();
    const where: Prisma.IceVoucherWhereInput = {
      year,
      ...(actorId ? { accommodationManagerId: actorId } : {}),
    };
    const [byStatus, byPayment, payableUnpaid] = await Promise.all([
      this.prisma.iceVoucher.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.iceVoucher.groupBy({
        by: ['paymentStatus'],
        where,
        _count: { _all: true },
      }),
      actorId
        ? this.prisma.iceVoucher.findMany({
            where: {
              ...where,
              paymentStatus: IceVoucherPaymentStatus.UNPAID,
              status: { not: IceVoucherStatus.REJECTED },
            },
            select: { id: true, totalCost: true },
          })
        : Promise.resolve([]),
    ]);
    const approved =
      byStatus.find((row) => row.status === IceVoucherStatus.APPROVED)?._count
        ._all ?? 0;
    const paid =
      byPayment.find((row) => row.paymentStatus === IceVoucherPaymentStatus.PAID)
        ?._count._all ?? 0;
    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    return {
      year,
      total,
      approved,
      unapproved: total - approved,
      paid,
      unpaid: total - paid,
      payableUnpaid,
    };
  }

  async mineStats(query: FindIceVoucherReportQueryDto, actorId: string) {
    return this.stats(query, actorId);
  }

  async findOne(id: string) {
    const item = await this.prisma.iceVoucher.findUnique({
      where: { id },
      include: voucherInclude,
    });
    if (!item) {
      throw new NotFoundException('حواله یخ یافت نشد');
    }
    return this.serialize(item);
  }

  async findMineOne(id: string, actorId: string) {
    const item = await this.findOne(id);
    if (item.accommodationManagerId !== actorId) {
      throw new NotFoundException('حواله یخ یافت نشد');
    }
    return item;
  }

  async findByCode(code: string) {
    const item = await this.prisma.iceVoucher.findUnique({
      where: { code: code.trim() },
      include: voucherInclude,
    });
    if (!item) {
      throw new NotFoundException('حواله یخ یافت نشد');
    }
    return this.serialize(item);
  }

  async createMine(dto: CreateIceVoucherDto, actor: Actor) {
    await this.assertCanUseAccommodation(dto.accommodationId, actor);
    const accommodation = await this.requireAccommodation(dto.accommodationId);
    const settings = await this.ensureSettings();
    const capacity = this.capacityOf(accommodation);
    const maxMoldCount = this.maxMoldCount(
      capacity,
      settings.moldsPer50Pilgrims,
    );
    if (dto.moldCount > maxMoldCount) {
      throw new BadRequestException(
        `حداکثر تعداد قالب یخ ${maxMoldCount} است`,
      );
    }
    const requestedAt = parseIsoDate(dto.requestedAt);
    this.assertRequestedAtInRange(requestedAt, settings);
    const year = currentJalaliYear(requestedAt);
    const created = await this.createWithSequentialCode({
      year,
      accommodationId: dto.accommodationId,
      accommodationManagerId: actor.id,
      requestedAt,
      moldCount: dto.moldCount,
      costPerMold: settings.costPerMold,
      totalCost: dto.moldCount * settings.costPerMold,
      description: dto.description?.trim() || null,
    });
    return this.serialize(created);
  }

  async payMine(ids: string[], actor: Actor) {
    const uniqueIds = [...new Set(ids)];
    const items = await this.prisma.iceVoucher.findMany({
      where: {
        id: { in: uniqueIds },
        accommodationManagerId: actor.id,
      },
    });
    if (items.length !== uniqueIds.length) {
      throw new NotFoundException('یک یا چند حواله یخ یافت نشد');
    }
    if (items.some((item) => item.status === IceVoucherStatus.REJECTED)) {
      throw new BadRequestException('حواله ردشده قابل پرداخت نیست');
    }
    if (items.some((item) => item.paymentStatus !== IceVoucherPaymentStatus.UNPAID)) {
      throw new BadRequestException('فقط حواله‌های پرداخت‌نشده را می‌توان پرداخت کرد');
    }

    const paidAt = new Date();
    await this.prisma.iceVoucher.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        paymentStatus: IceVoucherPaymentStatus.PAID,
        paidAt,
      },
    });

    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
    const payer = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { phone: true },
    });
    if (payer?.phone) {
      try {
        await this.sms.send({
          phone: payer.phone,
          body: `مبلغ ${this.formatFaAmount(totalCost)} تومان در بخش تدارکات و پشتیبانی ستاد جمعیت جهت دریافت یخ با موفقیت پرداخت شد`,
          sentById: actor.id,
        });
      } catch {
        // پرداخت ثبت شده؛ خطا در پیامک مانع تأیید پرداخت نمی‌شود
      }
    }

    const updated = await this.prisma.iceVoucher.findMany({
      where: { id: { in: uniqueIds } },
      include: voucherInclude,
    });
    return {
      totalCost,
      items: updated.map((item) => this.serialize(item)),
    };
  }

  async approve(id: string, actorId: string) {
    const current = await this.requireRecord(id);
    if (current.status !== IceVoucherStatus.PENDING) {
      throw new BadRequestException('فقط حواله در انتظار تأیید قابل تأیید است');
    }
    const updated = await this.prisma.iceVoucher.update({
      where: { id },
      data: {
        status: IceVoucherStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: actorId,
      },
      include: voucherInclude,
    });
    return this.serialize(updated);
  }

  async reject(id: string, actorId: string) {
    const current = await this.requireRecord(id);
    if (current.status !== IceVoucherStatus.PENDING) {
      throw new BadRequestException('فقط حواله در انتظار تأیید قابل رد است');
    }
    const updated = await this.prisma.iceVoucher.update({
      where: { id },
      data: {
        status: IceVoucherStatus.REJECTED,
        approvedAt: new Date(),
        approvedById: actorId,
      },
      include: voucherInclude,
    });
    return this.serialize(updated);
  }

  async removeMine(id: string, actorId: string) {
    const current = await this.requireRecord(id);
    if (current.accommodationManagerId !== actorId) {
      throw new NotFoundException('حواله یخ یافت نشد');
    }
    if (current.status !== IceVoucherStatus.PENDING) {
      throw new BadRequestException('فقط درخواست در انتظار تأیید قابل حذف است');
    }
    await this.prisma.iceVoucher.delete({ where: { id } });
    return { ok: true };
  }

  async remove(id: string) {
    const current = await this.requireRecord(id);
    if (current.status === IceVoucherStatus.APPROVED) {
      throw new BadRequestException('حواله تأییدشده قابل حذف نیست');
    }
    await this.prisma.iceVoucher.delete({ where: { id } });
    return { ok: true };
  }

  async report(query: FindIceVoucherReportQueryDto) {
    const year = query.year ?? currentJalaliYear();
    const items = await this.prisma.iceVoucher.findMany({
      where: { year },
      select: {
        status: true,
        paymentStatus: true,
        approvedAt: true,
        requestedAt: true,
        moldCount: true,
        totalCost: true,
      },
    });

    const byDayMap = new Map<
      string,
      { date: string; voucherCount: number; moldCount: number; totalCost: number }
    >();
    let issuedCount = 0;
    let totalCost = 0;
    let moldCount = 0;
    let paidCount = 0;
    let paidCost = 0;
    let unpaidCount = 0;
    let unpaidCost = 0;

    for (const item of items) {
      if (item.paymentStatus === IceVoucherPaymentStatus.PAID) {
        paidCount += 1;
        paidCost += item.totalCost;
      } else {
        unpaidCount += 1;
        unpaidCost += item.totalCost;
      }
      if (item.status !== IceVoucherStatus.APPROVED) {
        continue;
      }
      issuedCount += 1;
      totalCost += item.totalCost;
      moldCount += item.moldCount;
      const daySource = item.approvedAt ?? item.requestedAt;
      const date = this.tehranIsoDate(daySource);
      const row = byDayMap.get(date) ?? {
        date,
        voucherCount: 0,
        moldCount: 0,
        totalCost: 0,
      };
      row.voucherCount += 1;
      row.moldCount += item.moldCount;
      row.totalCost += item.totalCost;
      byDayMap.set(date, row);
    }

    return {
      year,
      issuedCount,
      moldCount,
      totalCost,
      paidCount,
      paidCost,
      unpaidCount,
      unpaidCost,
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  private async ensureSettings() {
    const existing = await this.prisma.iceVoucherSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.iceVoucherSettings.create({
      data: {
        id: SETTINGS_ID,
        moldsPer50Pilgrims: 1,
        costPerMold: 0,
      },
    });
  }

  private serializeSettings(item: {
    id: string;
    moldsPer50Pilgrims: number;
    costPerMold: number;
    activityStartDate: Date | null;
    activityEndDate: Date | null;
  }) {
    return {
      id: item.id,
      moldsPer50Pilgrims: item.moldsPer50Pilgrims,
      costPerMold: item.costPerMold,
      activityStartDate: item.activityStartDate?.toISOString().slice(0, 10) ?? null,
      activityEndDate: item.activityEndDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  private assertActivityRange(start: Date | null, end: Date | null) {
    if (start && end && start > end) {
      throw new BadRequestException(
        'تاریخ شروع فعالیت نمی‌تواند بعد از تاریخ پایان باشد',
      );
    }
  }

  private assertRequestedAtInRange(
    requestedAt: Date,
    settings: { activityStartDate: Date | null; activityEndDate: Date | null },
  ) {
    const day = requestedAt.toISOString().slice(0, 10);
    const start = settings.activityStartDate?.toISOString().slice(0, 10);
    const end = settings.activityEndDate?.toISOString().slice(0, 10);
    if ((start && day < start) || (end && day > end)) {
      throw new BadRequestException('تاریخ درخواست خارج از بازه مجاز فعالیت است');
    }
  }

  private async requireAccommodation(id: string) {
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        maleCapacity: true,
        femaleCapacity: true,
      },
    });
    if (!accommodation) {
      throw new BadRequestException('اسکان انتخاب‌شده معتبر نیست');
    }
    return accommodation;
  }

  private async requireRecord(id: string) {
    const item = await this.prisma.iceVoucher.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('حواله یخ یافت نشد');
    }
    return item;
  }

  private async assertCanUseAccommodation(accommodationId: string, actor: Actor) {
    if (isAdmin(actor)) {
      return;
    }
    const assignment = await this.prisma.accommodationManager.findFirst({
      where: { accommodationId, userId: actor.id },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException('این اسکان به شما اختصاص داده نشده است');
    }
  }

  private capacityOf(accommodation: {
    maleCapacity: number;
    femaleCapacity: number;
  }) {
    return accommodation.maleCapacity + accommodation.femaleCapacity;
  }

  private maxMoldCount(capacity: number, moldsPer50Pilgrims: number) {
    if (capacity <= 0 || moldsPer50Pilgrims <= 0) {
      return 0;
    }
    return Math.floor(capacity / 50) * moldsPer50Pilgrims;
  }

  private async createWithSequentialCode(
    data: Omit<Prisma.IceVoucherUncheckedCreateInput, 'code'>,
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.prisma.iceVoucher.create({
          data: {
            ...data,
            code: await this.nextSequentialCode(data.year),
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
    throw new BadRequestException('امکان صدور کد یکتای حواله یخ نبود');
  }

  private async nextSequentialCode(year: number) {
    const prefix = voucherCodePrefix(year, ICE_VOUCHER_KIND);
    const items = await this.prisma.iceVoucher.findMany({
      where: { year, code: { startsWith: prefix } },
      select: { code: true },
    });
    return nextSequentialVoucherCode(
      year,
      ICE_VOUCHER_KIND,
      items.map((item) => item.code),
    );
  }

  private listWhere(query: FindIceVouchersQueryDto): Prisma.IceVoucherWhereInput {
    const filters: Prisma.IceVoucherWhereInput[] = [];
    if (query.accommodationId) {
      filters.push({ accommodationId: query.accommodationId });
    }
    if (query.accommodationManagerId) {
      filters.push({ accommodationManagerId: query.accommodationManagerId });
    }
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.paymentStatus) {
      filters.push({ paymentStatus: query.paymentStatus });
    }
    if (query.year) {
      filters.push({ year: query.year });
    }
    if (query.q) {
      filters.push({
        OR: [
          { code: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { accommodation: { name: containsInsensitive(query.q) } },
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

  private serialize(item: IceVoucherRecord) {
    return {
      ...item,
      requestedAt: item.requestedAt.toISOString().slice(0, 10),
      approvedAt: item.approvedAt?.toISOString() ?? null,
      paidAt: item.paidAt?.toISOString() ?? null,
    };
  }

  private formatFaAmount(value: number) {
    const grouped = Math.trunc(value).toLocaleString('en-US').replace(/,/g, '٬');
    return grouped.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit);
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
