import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin } from '../auth/roles.util';
import { currentJalaliYear, jalaliYearRange } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import {
  HonoraryServiceWeekDay,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateHonoraryServantDto } from './dto/create-honorary-servant.dto';
import { CreateHonoraryServiceTypeDto } from './dto/create-honorary-service-type.dto';
import { FindHonoraryServantsQueryDto } from './dto/find-honorary-servants-query.dto';
import { FindHonoraryServiceTypesQueryDto } from './dto/find-honorary-service-types-query.dto';
import { UpdateHonoraryServantDto } from './dto/update-honorary-servant.dto';
import { UpdateHonoraryServiceTypeDto } from './dto/update-honorary-service-type.dto';
import {
  HONORARY_SERVANT_ROLE,
  honoraryServiceWeekDays,
  OTHER_SERVICE_TYPE,
} from './honorary-servants.constants';

const announcementInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      phone: true,
    },
  },
  serviceType: true,
} satisfies Prisma.HonoraryServiceAnnouncementInclude;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new BadRequestException('تاریخ معتبر نیست');
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

function uniqueWeekDays(days: HonoraryServiceWeekDay[]) {
  const allowed = new Set<string>(honoraryServiceWeekDays);
  const seen = new Set<HonoraryServiceWeekDay>();
  for (const day of days) {
    if (!allowed.has(day) || seen.has(day)) {
      continue;
    }
    seen.add(day);
  }
  return honoraryServiceWeekDays.filter((day) => seen.has(day));
}

@Injectable()
export class HonoraryServantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findTypes(query: FindHonoraryServiceTypesQueryDto) {
    const where = this.typeWhere(query);
    const orderBy = this.typeOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.honoraryServiceType.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.honoraryServiceType.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.honoraryServiceType.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findType(id: string) {
    const item = await this.prisma.honoraryServiceType.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('نوع خدمت یافت نشد');
    }
    return item;
  }

  async findCandidates(serviceTypeId: string) {
    await this.findType(serviceTypeId);
    const announcements = await this.prisma.honoraryServiceAnnouncement.findMany({
      where: { serviceTypeId },
      include: announcementInclude,
      orderBy: { user: { fullName: 'asc' } },
    });
    const seen = new Set<string>();
    const items = [];
    for (const item of announcements) {
      if (seen.has(item.userId)) continue;
      seen.add(item.userId);
      items.push({
        id: item.user.id,
        fullName: item.user.fullName,
        firstName: item.user.firstName,
        lastName: item.user.lastName,
        nationalId: item.user.nationalId,
        phone: item.user.phone,
      });
    }
    return { items };
  }

  createType(dto: CreateHonoraryServiceTypeDto) {
    return this.prisma.honoraryServiceType.create({
      data: {
        name: dto.name.trim(),
        description: dto.description.trim(),
      },
    });
  }

  async updateType(id: string, dto: UpdateHonoraryServiceTypeDto) {
    await this.findType(id);
    return this.prisma.honoraryServiceType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async removeType(id: string) {
    await this.findType(id);
    const [used, assigned] = await Promise.all([
      this.prisma.honoraryServiceAnnouncement.count({
        where: { serviceTypeId: id },
      }),
      this.prisma.reservationHonoraryAssignment.count({
        where: { serviceTypeId: id },
      }),
    ]);
    if (used) {
      throw new BadRequestException(
        'ابتدا اعلام همکاری‌های این نوع خدمت را حذف کنید',
      );
    }
    if (assigned) {
      throw new BadRequestException(
        'ابتدا تخصیص این نوع خدمت از پرونده‌های زیارتی را حذف کنید',
      );
    }
    await this.prisma.honoraryServiceType.delete({ where: { id } });
    return { ok: true };
  }

  async stats() {
    const year = currentJalaliYear();
    const range = jalaliYearRange(year);
    const [total, currentYear] = await Promise.all([
      this.prisma.user.count({
        where: { honoraryServiceAnnouncements: { some: {} } },
      }),
      this.prisma.user.count({
        where: {
          honoraryServiceAnnouncements: {
            some: {
              startDate: { lt: range.lt },
              endDate: { gte: range.gte },
            },
          },
        },
      }),
    ]);
    return { total, currentYear, year };
  }

  async findAll(query: FindHonoraryServantsQueryDto, userId?: string) {
    const where = this.listWhere(query, userId);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.honoraryServiceAnnouncement.findMany({
        where,
        orderBy,
        include: announcementInclude,
      });
      return items.map((item) => this.toPublic(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.honoraryServiceAnnouncement.findMany({
        where,
        orderBy,
        include: announcementInclude,
        skip,
        take,
      }),
      this.prisma.honoraryServiceAnnouncement.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.toPublic(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    return this.findOneFor(id);
  }

  async findOneFor(
    id: string,
    actor?: { id: string; userRoles?: { role: { code: string } }[] },
  ) {
    const item = await this.prisma.honoraryServiceAnnouncement.findUnique({
      where: { id },
      include: announcementInclude,
    });
    if (!item) {
      throw new NotFoundException('اعلام همکاری یافت نشد');
    }
    if (actor && !isAdmin(actor) && item.userId !== actor.id) {
      throw new ForbiddenException('دسترسی به این اعلام همکاری مجاز نیست');
    }
    return this.toPublic(item);
  }

  async findMine(userId: string, query: FindHonoraryServantsQueryDto) {
    return this.findAll({ ...query, page: query.page ?? 1 }, userId);
  }

  async create(dto: CreateHonoraryServantDto) {
    const data = await this.prepareData(dto);
    await this.assertUser(data.userId);
    const item = await this.prisma.honoraryServiceAnnouncement.create({
      data,
      include: announcementInclude,
    });
    await this.users.ensureRole(data.userId, HONORARY_SERVANT_ROLE);
    return this.toPublic(item);
  }

  async update(id: string, dto: UpdateHonoraryServantDto) {
    const current = await this.prisma.honoraryServiceAnnouncement.findUnique({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException('اعلام همکاری یافت نشد');
    }
    const merged = {
      userId: dto.userId ?? current.userId,
      serviceTypeId:
        dto.serviceTypeId === undefined
          ? current.serviceTypeId
          : dto.serviceTypeId,
      otherDescription:
        dto.otherDescription === undefined
          ? current.otherDescription
          : dto.otherDescription,
      startDate: dto.startDate ?? dateOnly(current.startDate),
      endDate: dto.endDate ?? dateOnly(current.endDate),
      weekDays: dto.weekDays ?? current.weekDays,
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
    };
    const data = await this.prepareData(merged);
    if (data.userId !== current.userId) {
      await this.assertUser(data.userId);
    }
    const item = await this.prisma.honoraryServiceAnnouncement.update({
      where: { id },
      data,
      include: announcementInclude,
    });
    await this.users.ensureRole(data.userId, HONORARY_SERVANT_ROLE);
    if (data.userId !== current.userId) {
      await this.syncRole(current.userId);
    }
    return this.toPublic(item);
  }

  async remove(id: string) {
    const item = await this.prisma.honoraryServiceAnnouncement.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!item) {
      throw new NotFoundException('اعلام همکاری یافت نشد');
    }
    await this.prisma.honoraryServiceAnnouncement.delete({ where: { id } });
    await this.syncRole(item.userId);
    return { ok: true };
  }

  private async prepareData(dto: {
    userId: string;
    serviceTypeId?: string | null;
    otherDescription?: string | null;
    startDate: string;
    endDate: string;
    weekDays: HonoraryServiceWeekDay[];
    startTime: string;
    endTime: string;
  }) {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('تاریخ پایان باید بعد از تاریخ شروع باشد');
    }
    const weekDays = uniqueWeekDays(dto.weekDays);
    if (!weekDays.length) {
      throw new BadRequestException('حداقل یک روز خدمت را انتخاب کنید');
    }
    const serviceTypeId = dto.serviceTypeId?.trim() || null;
    const otherDescription = dto.otherDescription?.trim() || null;
    if (serviceTypeId) {
      await this.findType(serviceTypeId);
      return {
        userId: dto.userId,
        serviceTypeId,
        otherDescription: null,
        startDate,
        endDate,
        weekDays,
        startTime: dto.startTime,
        endTime: dto.endTime,
      };
    }
    if (!otherDescription) {
      throw new BadRequestException(
        'نوع خدمت را انتخاب کنید یا برای گزینه سایر توضیح بنویسید',
      );
    }
    return {
      userId: dto.userId,
      serviceTypeId: null,
      otherDescription,
      startDate,
      endDate,
      weekDays,
      startTime: dto.startTime,
      endTime: dto.endTime,
    };
  }

  private async assertUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
  }

  private async syncRole(userId: string) {
    const remaining = await this.prisma.honoraryServiceAnnouncement.count({
      where: { userId },
    });
    if (remaining > 0) {
      await this.users.ensureRole(userId, HONORARY_SERVANT_ROLE);
      return;
    }
    await this.prisma.userRole.deleteMany({
      where: { userId, role: { code: HONORARY_SERVANT_ROLE } },
    });
  }

  private toPublic(
    item: Prisma.HonoraryServiceAnnouncementGetPayload<{
      include: typeof announcementInclude;
    }>,
  ) {
    return {
      ...item,
      startDate: dateOnly(item.startDate),
      endDate: dateOnly(item.endDate),
    };
  }

  private typeWhere(
    query: FindHonoraryServiceTypesQueryDto,
  ): Prisma.HonoraryServiceTypeWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
      ],
    };
  }

  private typeOrderBy(
    query: FindHonoraryServiceTypesQueryDto,
  ): Prisma.HonoraryServiceTypeOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HonoraryServiceTypeOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        description: (dir) => ({ description: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: FindHonoraryServantsQueryDto,
    userId?: string,
  ): Prisma.HonoraryServiceAnnouncementWhereInput {
    const filters: Prisma.HonoraryServiceAnnouncementWhereInput[] = [];
    if (userId) {
      filters.push({ userId });
    }
    if (query.year) {
      const range = jalaliYearRange(query.year);
      filters.push({
        startDate: { lt: range.lt },
        endDate: { gte: range.gte },
      });
    }
    if (query.serviceTypeId === OTHER_SERVICE_TYPE) {
      filters.push({ serviceTypeId: null });
    } else if (query.serviceTypeId) {
      filters.push({ serviceTypeId: query.serviceTypeId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { user: { fullName: containsInsensitive(query.q) } },
          { user: { firstName: containsInsensitive(query.q) } },
          { user: { lastName: containsInsensitive(query.q) } },
          { user: { nationalId: containsInsensitive(query.q) } },
          { user: { phone: containsInsensitive(query.q) } },
          { otherDescription: containsInsensitive(query.q) },
          { serviceType: { name: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindHonoraryServantsQueryDto,
  ): Prisma.HonoraryServiceAnnouncementOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HonoraryServiceAnnouncementOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        fullName: (dir) => ({ user: { fullName: dir } }),
        startDate: (dir) => ({ startDate: dir }),
        endDate: (dir) => ({ endDate: dir }),
        startTime: (dir) => ({ startTime: dir }),
        serviceType: (dir) => ({ serviceType: { name: dir } }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ startDate: 'desc' }, { id: 'asc' }],
    );
  }
}
