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
import {
  isSystemRoleCode,
  ROLE_ACCESS_MENU_CODE,
} from '../auth/system-roles';
import { CreateRoleDto } from './dto/create-role.dto';
import { FindRolesQueryDto } from './dto/find-roles-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const retiredMenuCodes = new Set([
  'base-info.medical-centers',
  'base-info.red-crescents',
  'dashboard.honorary-apply',
  'dashboard.introduce-accommodation',
]);
const retiredMenuNameKeys = new Set([
  'menus.medicalCenters',
  'menus.redCrescents',
]);

function isRetiredMenu(menu: { code: string; nameKey: string }) {
  return retiredMenuCodes.has(menu.code) || retiredMenuNameKeys.has(menu.nameKey);
}

const roleSelect = {
  id: true,
  code: true,
  nameKey: true,
  createdAt: true,
} satisfies Prisma.RoleSelect;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listLookup() {
    const rows = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        ...roleSelect,
        _count: { select: { userRoles: true, menus: true } },
      },
    });
    return rows.map((item) => this.toListItem(item));
  }

  async findAll(query: FindRolesQueryDto) {
    if (!wantsPagination(query)) {
      const items = await this.listLookup();
      return items;
    }

    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [rows, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          ...roleSelect,
          _count: { select: { userRoles: true, menus: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return paginatedResult(
      rows.map((item) => this.toListItem(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        ...roleSelect,
        _count: { select: { userRoles: true, menus: true } },
        menus: {
          select: {
            menuId: true,
            menu: { select: { code: true, nameKey: true } },
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('نقش یافت نشد');
    }
    const lockedMenuIds = await this.lockedMenuIdsFor(role.code);
    return {
      ...this.toListItem(role),
      menuIds: role.menus
        .filter((item) => !isRetiredMenu(item.menu))
        .map((item) => item.menuId),
      lockedMenuIds,
    };
  }

  async menuCatalog() {
    const modules = await this.prisma.navModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        nameKey: true,
        icon: true,
        sortOrder: true,
        menus: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            nameKey: true,
            path: true,
            icon: true,
            sortOrder: true,
          },
        },
      },
    });

    return modules
      .map((mod) => ({
        ...mod,
        menus: mod.menus.filter((menu) => !isRetiredMenu(menu)),
      }))
      .filter((mod) => mod.menus.length > 0);
  }

  async create(dto: CreateRoleDto) {
    if (isSystemRoleCode(dto.code) || dto.code === 'AUTHENTICATED') {
      throw new BadRequestException('این کد نقش رزرو شده است');
    }
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('نقشی با این کد قبلاً ثبت شده است');
    }
    const menuIds = await this.resolveMenuIds(dto.menuIds ?? []);
    try {
      const role = await this.prisma.role.create({
        data: {
          code: dto.code,
          nameKey: dto.name,
          menus: {
            create: menuIds.map((menuId) => ({ menuId })),
          },
        },
        select: { id: true },
      });
      return this.findOne(role.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('نقشی با این کد قبلاً ثبت شده است');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const current = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (!current) {
      throw new NotFoundException('نقش یافت نشد');
    }

    const isSystem = isSystemRoleCode(current.code);
    if (isSystem && dto.name != null) {
      throw new BadRequestException('نام نقش‌های سامانه قابل تغییر نیست');
    }

    const menuIds = await this.resolveMenuIds(dto.menuIds);
    const locked = await this.lockedMenuIdsFor(current.code);
    const nextMenuIds = [...new Set([...menuIds, ...locked])];

    await this.prisma.$transaction(async (tx) => {
      if (!isSystem && dto.name) {
        await tx.role.update({
          where: { id },
          data: { nameKey: dto.name },
        });
      }
      await tx.roleMenu.deleteMany({ where: { roleId: id } });
      if (nextMenuIds.length) {
        await tx.roleMenu.createMany({
          data: nextMenuIds.map((menuId) => ({ roleId: id, menuId })),
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        code: true,
        _count: { select: { userRoles: true } },
      },
    });
    if (!role) {
      throw new NotFoundException('نقش یافت نشد');
    }
    if (isSystemRoleCode(role.code)) {
      throw new BadRequestException('نقش‌های سامانه قابل حذف نیستند');
    }
    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        'این نقش به کاربر اختصاص داده شده و قابل حذف نیست',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }

  private toListItem(role: {
    id: string;
    code: string;
    nameKey: string;
    createdAt: Date;
    _count: { userRoles: number; menus: number };
  }) {
    return {
      id: role.id,
      code: role.code,
      nameKey: role.nameKey,
      createdAt: role.createdAt,
      isSystem: isSystemRoleCode(role.code),
      userCount: role._count.userRoles,
      menuCount: role._count.menus,
    };
  }

  private listWhere(query: FindRolesQueryDto): Prisma.RoleWhereInput {
    if (!query.q) {
      return {};
    }
    const q = containsInsensitive(query.q);
    return {
      OR: [{ code: q }, { nameKey: q }],
    };
  }

  private listOrderBy(
    query: FindRolesQueryDto,
  ): Prisma.RoleOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.RoleOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        code: (dir) => ({ code: dir }),
        nameKey: (dir) => ({ nameKey: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
        userCount: (dir) => ({ userRoles: { _count: dir } }),
        menuCount: (dir) => ({ menus: { _count: dir } }),
      },
      [{ createdAt: 'asc' }, { id: 'asc' }],
    );
  }

  private async resolveMenuIds(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      return [];
    }
    const menus = await this.prisma.menu.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, code: true, nameKey: true },
    });
    if (menus.length !== uniqueIds.length) {
      throw new BadRequestException('یکی از منوهای انتخاب‌شده معتبر نیست');
    }
    return menus.filter((menu) => !isRetiredMenu(menu)).map((menu) => menu.id);
  }

  private async lockedMenuIdsFor(code: string) {
    if (code !== 'ADMIN') {
      return [];
    }
    const menu = await this.prisma.menu.findUnique({
      where: { code: ROLE_ACCESS_MENU_CODE },
      select: { id: true },
    });
    return menu ? [menu.id] : [];
  }
}
