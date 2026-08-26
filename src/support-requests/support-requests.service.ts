import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildStyledExcelExport } from '../common/excel-export';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma, SupportRequestStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isAdmin } from '../auth/roles.util';
import {
  currentJalaliYear,
  jalaliMonth,
  jalaliYearRange,
} from '../common/jalali-year';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { FindSupportRequestReportQueryDto } from './dto/find-support-request-report-query.dto';
import { FindSupportRequestsQueryDto } from './dto/find-support-requests-query.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';
import {
  supportRequestStatusLabels,
  supportRequestStatuses,
  supportRequestTypeLabels,
  supportRequestTypes,
  type SupportRequestStatusValue,
  type SupportRequestTypeValue,
} from './support-request.constants';

type Actor = {
  id: string;
  issuingOrganizationId: string | null;
  userRoles?: { role: { code: string } }[];
  roles?: { code: string }[];
};

const listInclude = {
  organization: { select: { id: true, name: true } },
  handlingOrganization: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, fullName: true } },
  handledBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SupportRequestInclude;

@Injectable()
export class SupportRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindSupportRequestsQueryDto, actor: Actor) {
    const where = this.listWhere(query, actor);
    const orderBy = this.listOrderBy(query);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.supportRequest.findMany({
        where,
        orderBy,
        skip,
        take,
        include: listInclude,
      }),
      this.prisma.supportRequest.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async exportExcel(query: FindSupportRequestsQueryDto, actor: Actor) {
    const items = await this.prisma.supportRequest.findMany({
      where: this.listWhere(query, actor),
      orderBy: this.listOrderBy(query),
      include: listInclude,
    });
    return buildStyledExcelExport({
      sheetName: 'درخواست پشتیبانی',
      columns: [
        { header: 'تاریخ درخواست', key: 'requestedAt', width: 16 },
        { header: 'سازمان درخواست‌کننده', key: 'organization', width: 28 },
        { header: 'نوع درخواست', key: 'type', width: 16 },
        { header: 'عنوان مورد درخواست', key: 'subject', width: 28 },
        { header: 'تعداد', key: 'quantity', width: 10 },
        { header: 'تاریخ نیاز', key: 'neededBy', width: 16 },
        { header: 'توضیحات', key: 'description', width: 32 },
        { header: 'وضعیت', key: 'status', width: 16 },
        { header: 'سازمان رسیدگی‌کننده', key: 'handlingOrganization', width: 28 },
        { header: 'تاریخ رسیدگی', key: 'handledAt', width: 16 },
        { header: 'توضیحات رسیدگی', key: 'handlingNotes', width: 32 },
        { header: 'ثبت‌کننده', key: 'requestedBy', width: 22 },
        { header: 'رسیدگی‌کننده', key: 'handledBy', width: 22 },
      ],
      rows: items.map((item) => ({
        requestedAt: toDateOnly(item.requestedAt),
        organization: item.organization.name,
        type: supportRequestTypeLabels[item.type as SupportRequestTypeValue],
        subject: item.subject,
        quantity: item.quantity ?? '',
        neededBy: item.neededBy ? toDateOnly(item.neededBy) : '',
        description: item.description ?? '',
        status: supportRequestStatusLabels[item.status as SupportRequestStatusValue],
        handlingOrganization: item.handlingOrganization?.name ?? '',
        handledAt: item.handledAt ? toDateOnly(item.handledAt) : '',
        handlingNotes: item.handlingNotes ?? '',
        requestedBy: item.requestedBy?.fullName ?? '',
        handledBy: item.handledBy?.fullName ?? '',
      })),
    });
  }

  async report(query: FindSupportRequestReportQueryDto, actor: Actor) {
    const year = query.year ?? currentJalaliYear();
    const range = this.reportDateRange(year, query.fromDate, query.toDate);
    const where: Prisma.SupportRequestWhereInput = {
      ...this.listWhere(query, actor),
      requestedAt: { gte: range.gte, lt: range.lt },
    };
    const items = await this.prisma.supportRequest.findMany({
      where,
      select: {
        type: true,
        status: true,
        quantity: true,
        requestedAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
        handlingOrganizationId: true,
        handlingOrganization: { select: { id: true, name: true } },
      },
    });

    const totals = emptyStatusBucket();
    const byTypeMap = new Map<SupportRequestTypeValue, StatusBucket & { type: SupportRequestTypeValue }>();
    const byStatusMap = new Map<SupportRequestStatusValue, { status: SupportRequestStatusValue; count: number; quantity: number }>();
    const byOrgMap = new Map<string, OrgBucket>();
    const byHandlingMap = new Map<string, { id: string; name: string; count: number; quantity: number }>();
    const byMonthMap = new Map<number, { month: number; count: number; quantity: number }>();

    for (const type of supportRequestTypes) {
      byTypeMap.set(type, { type, ...emptyStatusBucket() });
    }
    for (const status of supportRequestStatuses) {
      byStatusMap.set(status, { status, count: 0, quantity: 0 });
    }

    for (const item of items) {
      const qty = item.quantity ?? 0;
      addStatus(totals, item.status, qty);

      const typeRow = byTypeMap.get(item.type as SupportRequestTypeValue);
      if (typeRow) {
        addStatus(typeRow, item.status, qty);
      }

      const statusRow = byStatusMap.get(item.status as SupportRequestStatusValue);
      if (statusRow) {
        statusRow.count += 1;
        statusRow.quantity += qty;
      }

      const org = byOrgMap.get(item.organizationId) ?? {
        id: item.organization.id,
        name: item.organization.name,
        ...emptyStatusBucket(),
      };
      addStatus(org, item.status, qty);
      byOrgMap.set(item.organizationId, org);

      if (item.handlingOrganization) {
        const handling = byHandlingMap.get(item.handlingOrganization.id) ?? {
          id: item.handlingOrganization.id,
          name: item.handlingOrganization.name,
          count: 0,
          quantity: 0,
        };
        handling.count += 1;
        handling.quantity += qty;
        byHandlingMap.set(item.handlingOrganization.id, handling);
      }

      const month = jalaliMonth(item.requestedAt);
      const monthRow = byMonthMap.get(month) ?? { month, count: 0, quantity: 0 };
      monthRow.count += 1;
      monthRow.quantity += qty;
      byMonthMap.set(month, monthRow);
    }

    return {
      year,
      fromDate: query.fromDate?.slice(0, 10) ?? toDateOnly(range.gte),
      toDate: query.toDate?.slice(0, 10) ?? toDateOnly(new Date(range.lt.getTime() - 1)),
      total: totals.count,
      quantity: totals.quantity,
      pending: totals.pending,
      inProgress: totals.inProgress,
      fulfilled: totals.fulfilled,
      rejected: totals.rejected,
      byType: [...byTypeMap.values()],
      byStatus: [...byStatusMap.values()],
      byOrganization: [...byOrgMap.values()].sort((a, b) => b.count - a.count),
      byHandlingOrganization: [...byHandlingMap.values()].sort((a, b) => b.count - a.count),
      byMonth: [...byMonthMap.values()].sort((a, b) => a.month - b.month),
    };
  }

  async findOne(id: string, actor: Actor) {
    const item = await this.prisma.supportRequest.findUnique({
      where: { id },
      include: listInclude,
    });
    if (!item) {
      throw new NotFoundException('درخواست یافت نشد');
    }
    this.assertCanView(item.organizationId, actor);
    return this.serialize(item);
  }

  async create(dto: CreateSupportRequestDto, actor: Actor) {
    const organizationId = await this.resolveOrganizationId(dto.organizationId, actor);
    const requestedAt = parseDateOnly(dto.requestedAt, 'تاریخ درخواست');
    const neededBy =
      dto.neededBy == null
        ? null
        : parseDateOnly(dto.neededBy, 'تاریخ نیاز');
    const item = await this.prisma.supportRequest.create({
      data: {
        organizationId,
        type: dto.type,
        subject: dto.subject.trim(),
        quantity: dto.quantity ?? null,
        requestedAt,
        neededBy,
        description: dto.description?.trim() || null,
        requestedById: actor.id,
      },
      include: listInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateSupportRequestDto, actor: Actor) {
    const current = await this.prisma.supportRequest.findUnique({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException('درخواست یافت نشد');
    }
    this.assertCanView(current.organizationId, actor);
    const admin = isAdmin(actor);
    if (!admin && current.status !== SupportRequestStatus.PENDING) {
      throw new ForbiddenException('فقط درخواست در انتظار بررسی قابل ویرایش است');
    }

    const data: Prisma.SupportRequestUpdateInput = {};
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.subject !== undefined) {
      data.subject = dto.subject.trim();
    }
    if (dto.quantity !== undefined) {
      data.quantity = dto.quantity;
    }
    if (dto.requestedAt !== undefined) {
      data.requestedAt = parseDateOnly(dto.requestedAt, 'تاریخ درخواست');
    }
    if (dto.neededBy !== undefined) {
      data.neededBy =
        dto.neededBy == null
          ? null
          : parseDateOnly(dto.neededBy, 'تاریخ نیاز');
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (admin && dto.organizationId !== undefined && dto.organizationId) {
      await this.assertOrganizationExists(dto.organizationId);
      data.organization = { connect: { id: dto.organizationId } };
    }

    if (admin) {
      if (dto.status !== undefined && dto.status) {
        data.status = dto.status;
      }
      if (dto.handlingOrganizationId !== undefined) {
        if (dto.handlingOrganizationId) {
          await this.assertOrganizationExists(dto.handlingOrganizationId);
          data.handlingOrganization = {
            connect: { id: dto.handlingOrganizationId },
          };
        } else {
          data.handlingOrganization = { disconnect: true };
        }
      }
      if (dto.handledAt !== undefined) {
        data.handledAt =
          dto.handledAt == null
            ? null
            : parseDateOnly(dto.handledAt, 'تاریخ رسیدگی');
      }
      if (dto.handlingNotes !== undefined) {
        data.handlingNotes = dto.handlingNotes?.trim() || null;
      }

      const nextStatus = dto.status ?? current.status;
      if (
        nextStatus !== SupportRequestStatus.PENDING &&
        current.status === SupportRequestStatus.PENDING
      ) {
        if (dto.handledAt === undefined && !current.handledAt) {
          data.handledAt = startOfTodayUtc();
        }
        if (!current.handledById) {
          data.handledBy = { connect: { id: actor.id } };
        }
      }
    }

    const item = await this.prisma.supportRequest.update({
      where: { id },
      data,
      include: listInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string, actor: Actor) {
    const current = await this.prisma.supportRequest.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('درخواست یافت نشد');
    }
    this.assertCanView(current.organizationId, actor);
    if (!isAdmin(actor) && current.status !== SupportRequestStatus.PENDING) {
      throw new ForbiddenException('فقط درخواست در انتظار بررسی قابل حذف است');
    }
    await this.prisma.supportRequest.delete({ where: { id } });
    return { ok: true };
  }

  private listOrderBy(
    query: FindSupportRequestsQueryDto,
  ): Prisma.SupportRequestOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.SupportRequestOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        requestedAt: (dir) => ({ requestedAt: dir }),
        type: (dir) => ({ type: dir }),
        subject: (dir) => ({ subject: dir }),
        quantity: (dir) => ({ quantity: dir }),
        status: (dir) => ({ status: dir }),
        organization: (dir) => ({ organization: { name: dir } }),
        handlingOrganization: (dir) => ({
          handlingOrganization: { name: dir },
        }),
        handledAt: (dir) => ({ handledAt: dir }),
        neededBy: (dir) => ({ neededBy: dir }),
      },
      [{ requestedAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: Pick<
      FindSupportRequestsQueryDto,
      'q' | 'type' | 'status' | 'organizationId' | 'handlingOrganizationId'
    >,
    actor: Actor,
  ): Prisma.SupportRequestWhereInput {
    const where: Prisma.SupportRequestWhereInput = {};
    if (!isAdmin(actor)) {
      if (!actor.issuingOrganizationId) {
        where.id = { in: [] };
        return where;
      }
      where.organizationId = actor.issuingOrganizationId;
    } else if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.handlingOrganizationId && isAdmin(actor)) {
      where.handlingOrganizationId = query.handlingOrganizationId;
    }
    if (query.q) {
      where.OR = [
        { subject: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { handlingNotes: containsInsensitive(query.q) },
        { organization: { name: containsInsensitive(query.q) } },
        { handlingOrganization: { name: containsInsensitive(query.q) } },
      ];
    }
    return where;
  }

  private reportDateRange(year: number, fromDate?: string, toDate?: string) {
    const yearRange = jalaliYearRange(year);
    let gte = yearRange.gte;
    let lt = yearRange.lt;
    if (fromDate) {
      const from = parseDateOnly(fromDate, 'از تاریخ');
      if (from > gte) {
        gte = from;
      }
    }
    if (toDate) {
      const to = parseDateOnly(toDate, 'تا تاریخ');
      const next = new Date(to.getTime() + 24 * 60 * 60 * 1000);
      if (next < lt) {
        lt = next;
      }
    }
    if (gte >= lt) {
      throw new BadRequestException('بازه تاریخ معتبر نیست');
    }
    return { gte, lt };
  }

  private async resolveOrganizationId(
    requestedId: string | null | undefined,
    actor: Actor,
  ) {
    if (isAdmin(actor)) {
      if (!requestedId) {
        throw new BadRequestException('سازمان درخواست‌کننده را انتخاب کنید');
      }
      await this.assertOrganizationExists(requestedId);
      return requestedId;
    }
    if (!actor.issuingOrganizationId) {
      throw new BadRequestException(
        'سازمان شما مشخص نیست؛ ابتدا سازمان مسئول را در پروفایل کاربر ثبت کنید',
      );
    }
    return actor.issuingOrganizationId;
  }

  private async assertOrganizationExists(id: string) {
    const organization = await this.prisma.governmentOrganization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new BadRequestException('سازمان انتخاب‌شده معتبر نیست');
    }
  }

  private assertCanView(organizationId: string, actor: Actor) {
    if (isAdmin(actor)) {
      return;
    }
    if (actor.issuingOrganizationId !== organizationId) {
      throw new ForbiddenException('دسترسی به این درخواست مجاز نیست');
    }
  }

  private serialize(
    item: Prisma.SupportRequestGetPayload<{ include: typeof listInclude }>,
  ) {
    return {
      ...item,
      requestedAt: toDateOnly(item.requestedAt),
      neededBy: item.neededBy ? toDateOnly(item.neededBy) : null,
      handledAt: item.handledAt ? toDateOnly(item.handledAt) : null,
    };
  }
}

function parseDateOnly(value: string, field: string) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException(`${field} معتبر نیست`);
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfTodayUtc() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

type StatusBucket = {
  count: number;
  quantity: number;
  pending: number;
  inProgress: number;
  fulfilled: number;
  rejected: number;
};

type OrgBucket = StatusBucket & { id: string; name: string };

function emptyStatusBucket(): StatusBucket {
  return {
    count: 0,
    quantity: 0,
    pending: 0,
    inProgress: 0,
    fulfilled: 0,
    rejected: 0,
  };
}

function addStatus(
  bucket: StatusBucket,
  status: SupportRequestStatus | SupportRequestStatusValue,
  quantity: number,
) {
  bucket.count += 1;
  bucket.quantity += quantity;
  if (status === 'PENDING') bucket.pending += 1;
  if (status === 'IN_PROGRESS') bucket.inProgress += 1;
  if (status === 'FULFILLED') bucket.fulfilled += 1;
  if (status === 'REJECTED') bucket.rejected += 1;
}
