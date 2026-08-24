import {
  BadRequestException,
  ForbiddenException,
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
import { CaravanContactRole, AccommodationContactRole, Prisma } from '../generated/prisma/client';
import { currentJalaliYear } from '../common/jalali-year';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { UsersService } from '../users/users.service';
import { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import { FindOrgUnitsQueryDto } from './dto/find-org-units-query.dto';
import { FindUnitLiaisonsQueryDto } from './dto/find-unit-liaisons-query.dto';
import {
  InviteLiaisonKind,
  InviteOrgUnitLiaisonsSmsDto,
} from './dto/invite-org-unit-liaisons-sms.dto';
import { SetOrgUnitLiaisonsDto } from './dto/set-org-unit-liaisons.dto';
import { UpdateOrgUnitDto } from './dto/update-org-unit.dto';

const managerSelect = {
  id: true,
  fullName: true,
  phone: true,
  nationalId: true,
} satisfies Prisma.UserSelect;

const orgUnitInclude = {
  manager: { select: managerSelect },
  _count: {
    select: {
      accommodationLiaisons: true,
      caravanLiaisons: true,
    },
  },
} satisfies Prisma.OrgUnitInclude;

type OrgUnitRecord = Prisma.OrgUnitGetPayload<{
  include: typeof orgUnitInclude;
}>;

const liaisonUserSelect = {
  id: true,
  fullName: true,
  phone: true,
  nationalId: true,
  status: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class OrgUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sms: SmsService,
  ) {}

  async findAll(query: FindOrgUnitsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.orgUnit.findMany({
        where,
        orderBy,
        include: orgUnitInclude,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.orgUnit.findMany({
        where,
        orderBy,
        skip,
        take,
        include: orgUnitInclude,
      }),
      this.prisma.orgUnit.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.orgUnit.findUnique({
      where: { id },
      include: orgUnitInclude,
    });
    if (!item) {
      throw new NotFoundException('واحد یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateOrgUnitDto) {
    const managerUserId = await this.resolveManager(dto.managerUserId);
    const item = await this.prisma.orgUnit.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        description: dto.description?.trim() || null,
        eitaaChannel: dto.eitaaChannel?.trim() || null,
        telegramChannel: dto.telegramChannel?.trim() || null,
        managerUserId,
      },
      include: orgUnitInclude,
    });
    await this.syncUnitManagerRole(managerUserId);
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateOrgUnitDto) {
    const current = await this.findOne(id);
    const previousManagerId = current.managerUserId;
    const managerUserId =
      dto.managerUserId === undefined
        ? previousManagerId
        : await this.resolveManager(dto.managerUserId);
    const item = await this.prisma.orgUnit.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        eitaaChannel:
          dto.eitaaChannel === undefined
            ? undefined
            : dto.eitaaChannel?.trim() || null,
        telegramChannel:
          dto.telegramChannel === undefined
            ? undefined
            : dto.telegramChannel?.trim() || null,
        managerUserId:
          dto.managerUserId === undefined ? undefined : managerUserId,
      },
      include: orgUnitInclude,
    });
    if (previousManagerId !== item.managerUserId) {
      await this.syncUnitManagerRole(previousManagerId);
      await this.syncUnitManagerRole(item.managerUserId);
    } else if (item.managerUserId) {
      await this.syncUnitManagerRole(item.managerUserId);
    }
    return this.serialize(item);
  }

  async remove(id: string) {
    const current = await this.findOne(id);
    await this.prisma.orgUnit.delete({ where: { id } });
    await this.syncUnitManagerRole(current.managerUserId);
    return { ok: true };
  }

  async getLiaisons(unitId: string) {
    await this.findOne(unitId);
    const [accommodation, caravan] = await Promise.all([
      this.prisma.orgUnitAccommodationLiaison.findMany({
        where: { unitId },
        orderBy: { role: 'asc' },
      }),
      this.prisma.orgUnitCaravanLiaison.findMany({
        where: { unitId },
        orderBy: { role: 'asc' },
      }),
    ]);
    return {
      accommodationRoles: accommodation.map((row) => row.role),
      caravanRoles: caravan.map((row) => row.role),
    };
  }

  async setLiaisons(unitId: string, dto: SetOrgUnitLiaisonsDto) {
    await this.findOne(unitId);
    const accommodationRoles = [
      ...new Set(dto.accommodationRoles),
    ] as AccommodationContactRole[];
    const caravanRoles = [...new Set(dto.caravanRoles)] as CaravanContactRole[];

    await this.prisma.$transaction(async (tx) => {
      await tx.orgUnitAccommodationLiaison.deleteMany({ where: { unitId } });
      await tx.orgUnitCaravanLiaison.deleteMany({ where: { unitId } });
      if (accommodationRoles.length) {
        await tx.orgUnitAccommodationLiaison.createMany({
          data: accommodationRoles.map((role) => ({ unitId, role })),
        });
      }
      if (caravanRoles.length) {
        await tx.orgUnitCaravanLiaison.createMany({
          data: caravanRoles.map((role) => ({ unitId, role })),
        });
      }
    });

    return this.getLiaisons(unitId);
  }

  async findMyAccommodationLiaisons(
    actorId: string,
    isAdmin: boolean,
    query: FindUnitLiaisonsQueryDto,
  ) {
    return this.findMyResolvedLiaisons('accommodation', actorId, isAdmin, query);
  }

  async findMyCaravanLiaisons(
    actorId: string,
    isAdmin: boolean,
    query: FindUnitLiaisonsQueryDto,
  ) {
    return this.findMyResolvedLiaisons('caravan', actorId, isAdmin, query);
  }

  private async findMyResolvedLiaisons(
    kind: 'accommodation' | 'caravan',
    actorId: string,
    isAdmin: boolean,
    query: FindUnitLiaisonsQueryDto,
  ) {
    const units = await this.prisma.orgUnit.findMany({
      where: isAdmin ? undefined : { managerUserId: actorId },
      select: {
        id: true,
        name: true,
        accommodationLiaisons: { select: { role: true } },
        caravanLiaisons: { select: { role: true } },
      },
      orderBy: { name: 'asc' },
    });

    const roleToUnits = new Map<string, { id: string; name: string }[]>();
    for (const unit of units) {
      const roles =
        kind === 'accommodation'
          ? unit.accommodationLiaisons.map((row) => row.role)
          : unit.caravanLiaisons.map((row) => row.role);
      for (const role of roles) {
        const list = roleToUnits.get(role) ?? [];
        list.push({ id: unit.id, name: unit.name });
        roleToUnits.set(role, list);
      }
    }

    const roles = [...roleToUnits.keys()];
    const { page, pageSize } = paginationArgs(query);
    if (!roles.length) {
      return paginatedResult([], 0, page, pageSize);
    }

    const userFilter: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      ...(query.q
        ? {
            OR: [
              { fullName: containsInsensitive(query.q) },
              { phone: containsInsensitive(query.q) },
              { nationalId: containsInsensitive(query.q) },
            ],
          }
        : {}),
    };

    type ResolvedRow = {
      id: string;
      fullName: string;
      phone: string | null;
      nationalId: string | null;
      role: string;
      place: { id: string; name: string };
      units: { id: string; name: string }[];
    };

    const rows: ResolvedRow[] = [];

    if (kind === 'accommodation') {
      const accommodationRoles = roles as AccommodationContactRole[];
      const year = currentJalaliYear();
      const [permanent, yearly] = await Promise.all([
        this.prisma.accommodationContact.findMany({
          where: {
            role: { in: accommodationRoles },
            user: userFilter,
          },
          include: {
            user: { select: liaisonUserSelect },
            accommodation: { select: { id: true, name: true } },
          },
        }),
        this.prisma.accommodationYearContact.findMany({
          where: {
            year,
            role: { in: accommodationRoles },
            user: userFilter,
          },
          include: {
            user: { select: liaisonUserSelect },
            accommodation: { select: { id: true, name: true } },
          },
        }),
      ]);

      const seen = new Set<string>();
      for (const contact of [...yearly, ...permanent]) {
        const key = `${contact.userId}:${contact.role}:${contact.accommodationId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          id: key,
          fullName: contact.user.fullName,
          phone: contact.user.phone,
          nationalId: contact.user.nationalId,
          role: contact.role,
          place: contact.accommodation,
          units: roleToUnits.get(contact.role) ?? [],
        });
      }
    } else {
      const caravanRoles = roles as CaravanContactRole[];
      const contacts = await this.prisma.caravanContact.findMany({
        where: {
          role: { in: caravanRoles },
          user: userFilter,
        },
        include: {
          user: { select: liaisonUserSelect },
          caravan: { select: { id: true, name: true } },
        },
      });
      for (const contact of contacts) {
        const key = `${contact.userId}:${contact.role}:${contact.caravanId}`;
        rows.push({
          id: key,
          fullName: contact.user.fullName,
          phone: contact.user.phone,
          nationalId: contact.user.nationalId,
          role: contact.role,
          place: contact.caravan,
          units: roleToUnits.get(contact.role) ?? [],
        });
      }
    }

    const dir = query.sortDir === 'desc' ? -1 : 1;
    const sortBy = query.sortBy ?? 'fullName';
    rows.sort((a, b) => {
      const left =
        sortBy === 'phone'
          ? a.phone ?? ''
          : sortBy === 'nationalId'
            ? a.nationalId ?? ''
            : sortBy === 'role'
              ? a.role
              : a.fullName;
      const right =
        sortBy === 'phone'
          ? b.phone ?? ''
          : sortBy === 'nationalId'
            ? b.nationalId ?? ''
            : sortBy === 'role'
              ? b.role
              : b.fullName;
      return left.localeCompare(right, 'fa') * dir || a.id.localeCompare(b.id);
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return paginatedResult(rows.slice(start, start + pageSize), total, page, pageSize);
  }

  private listOrderBy(
    query: FindOrgUnitsQueryDto,
  ): Prisma.OrgUnitOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.OrgUnitOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        phone: (dir) => ({ phone: dir }),
        manager: (dir) => ({ manager: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private listWhere(query: FindOrgUnitsQueryDto): Prisma.OrgUnitWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { phone: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { manager: { fullName: containsInsensitive(query.q) } },
      ],
    };
  }

  private async resolveManager(managerUserId?: string | null) {
    if (managerUserId == null || managerUserId === '') {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('مسئول واحد معتبر نیست');
    }
    return user.id;
  }

  private async syncUnitManagerRole(userId: string | null | undefined) {
    if (!userId) {
      return;
    }
    const stillManages = await this.prisma.orgUnit.count({
      where: { managerUserId: userId },
    });
    if (stillManages > 0) {
      await this.users.ensureRole(userId, 'UNIT_MANAGER');
      return;
    }
    await this.prisma.userRole.deleteMany({
      where: { userId, role: { code: 'UNIT_MANAGER' } },
    });
  }

  private serialize(item: OrgUnitRecord) {
    return {
      id: item.id,
      name: item.name,
      phone: item.phone,
      description: item.description,
      eitaaChannel: item.eitaaChannel,
      telegramChannel: item.telegramChannel,
      managerUserId: item.managerUserId,
      manager: item.manager,
      accommodationLiaisonCount: item._count.accommodationLiaisons,
      caravanLiaisonCount: item._count.caravanLiaisons,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async inviteLiaisonsSms(
    unitId: string,
    dto: InviteOrgUnitLiaisonsSmsDto,
    actor: { id: string },
    admin: boolean,
  ) {
    const unit = await this.prisma.orgUnit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('واحد یافت نشد');
    }
    if (!admin && unit.managerUserId !== actor.id) {
      throw new ForbiddenException('دسترسی به این واحد مجاز نیست');
    }
    return this.sendChannelInviteForUnit(unit, dto.kind ?? 'all', actor.id);
  }

  async inviteMyLiaisonsSms(
    dto: InviteOrgUnitLiaisonsSmsDto,
    actor: { id: string },
    admin: boolean,
  ) {
    const kind = dto.kind ?? 'all';
    const units = await this.prisma.orgUnit.findMany({
      where: admin ? undefined : { managerUserId: actor.id },
      orderBy: { name: 'asc' },
    });
    if (!units.length) {
      throw new BadRequestException('واحدی برای ارسال پیامک یافت نشد');
    }

    let recipientCount = 0;
    let unitsSent = 0;
    const skipped: { unitId: string; name: string; reason: string }[] = [];

    for (const unit of units) {
      try {
        const result = await this.sendChannelInviteForUnit(
          unit,
          kind,
          actor.id,
        );
        recipientCount += result.recipientCount;
        unitsSent += 1;
      } catch (error) {
        let reason = 'خطا در ارسال';
        if (error instanceof BadRequestException) {
          const response = error.getResponse();
          reason =
            typeof response === 'string'
              ? response
              : typeof response === 'object' &&
                  response &&
                  'message' in response
                ? Array.isArray((response as { message: unknown }).message)
                  ? String((response as { message: string[] }).message[0])
                  : String((response as { message: unknown }).message)
                : error.message;
        } else if (error instanceof Error) {
          reason = error.message;
        }
        skipped.push({ unitId: unit.id, name: unit.name, reason });
      }
    }

    if (!unitsSent && skipped.length) {
      throw new BadRequestException(
        skipped[0]?.reason || 'امکان ارسال پیامک دعوت وجود ندارد',
      );
    }

    return {
      queued: true as const,
      recipientCount,
      unitsSent,
      skipped,
    };
  }

  private async sendChannelInviteForUnit(
    unit: {
      id: string;
      name: string;
      eitaaChannel: string | null;
      telegramChannel: string | null;
    },
    kind: InviteLiaisonKind,
    sentById: string,
  ) {
    const eitaa = unit.eitaaChannel?.trim() || '';
    const telegram = unit.telegramChannel?.trim() || '';
    if (!eitaa && !telegram) {
      throw new BadRequestException(
        `برای واحد «${unit.name}» آدرس کانال ایتا یا تلگرام ثبت نشده است`,
      );
    }

    const phones = await this.collectLiaisonPhones(unit.id, kind);
    if (!phones.length) {
      throw new BadRequestException(
        `برای واحد «${unit.name}» رابطی با شماره تلفن یافت نشد`,
      );
    }

    const body = this.buildChannelInviteBody(unit.name, eitaa, telegram);
    return this.sms.send({ phones, body, sentById });
  }

  private async collectLiaisonPhones(
    unitId: string,
    kind: InviteLiaisonKind,
  ): Promise<string[]> {
    const phones = new Set<string>();
    const unit = await this.prisma.orgUnit.findUnique({
      where: { id: unitId },
      select: {
        accommodationLiaisons: { select: { role: true } },
        caravanLiaisons: { select: { role: true } },
      },
    });
    if (!unit) {
      return [];
    }

    if (kind === 'accommodation' || kind === 'all') {
      const roles = unit.accommodationLiaisons.map((row) => row.role);
      if (roles.length) {
        const year = currentJalaliYear();
        const [permanent, yearly] = await Promise.all([
          this.prisma.accommodationContact.findMany({
            where: {
              role: { in: roles },
              user: { status: 'ACTIVE', phone: { not: null } },
            },
            select: { user: { select: { phone: true } } },
          }),
          this.prisma.accommodationYearContact.findMany({
            where: {
              year,
              role: { in: roles },
              user: { status: 'ACTIVE', phone: { not: null } },
            },
            select: { user: { select: { phone: true } } },
          }),
        ]);
        for (const row of [...permanent, ...yearly]) {
          const phone = row.user.phone?.trim();
          if (phone) phones.add(phone);
        }
      }
    }

    if (kind === 'caravan' || kind === 'all') {
      const roles = unit.caravanLiaisons.map((row) => row.role);
      if (roles.length) {
        const rows = await this.prisma.caravanContact.findMany({
          where: {
            role: { in: roles },
            user: { status: 'ACTIVE', phone: { not: null } },
          },
          select: { user: { select: { phone: true } } },
        });
        for (const row of rows) {
          const phone = row.user.phone?.trim();
          if (phone) phones.add(phone);
        }
      }
    }

    return [...phones];
  }

  private buildChannelInviteBody(
    unitName: string,
    eitaa: string,
    telegram: string,
  ) {
    const lines = [
      `سلام، لطفاً برای عضویت در کانال‌های واحد «${unitName}» از لینک‌های زیر استفاده کنید:`,
    ];
    if (eitaa) lines.push(`ایتا: ${eitaa}`);
    if (telegram) lines.push(`تلگرام: ${telegram}`);
    return lines.join('\n');
  }
}
