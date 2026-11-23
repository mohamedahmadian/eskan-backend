import 'dotenv/config';
import {
  ADMIN_FORBIDDEN_MINE_MENU_CODES,
  adminMenuCodes,
  DEFAULT_MENU_CODES_BY_ROLE,
} from '../src/auth/role-menu-defaults';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const usersModule = await prisma.navModule.findUnique({
    where: { code: 'users' },
  });
  if (!usersModule) {
    throw new Error('ماژول کاربران یافت نشد');
  }

  const rolesMenu = await prisma.menu.upsert({
    where: { code: 'users.roles' },
    update: {
      nameKey: 'menus.roleAccess',
      path: '/system-management/roles',
      icon: 'shield',
      sortOrder: 2,
      moduleId: usersModule.id,
    },
    create: {
      code: 'users.roles',
      nameKey: 'menus.roleAccess',
      path: '/system-management/roles',
      icon: 'shield',
      sortOrder: 2,
      moduleId: usersModule.id,
    },
  });

  const newUserMenu = await prisma.menu.upsert({
    where: { code: 'users.new' },
    update: {
      nameKey: 'menus.newUser',
      path: '/users/new',
      icon: 'user-round-plus',
      sortOrder: 3,
      moduleId: usersModule.id,
    },
    create: {
      code: 'users.new',
      nameKey: 'menus.newUser',
      path: '/users/new',
      icon: 'user-round-plus',
      sortOrder: 3,
      moduleId: usersModule.id,
    },
  });

  await prisma.menu.update({
    where: { code: 'users.list' },
    data: { sortOrder: 1, moduleId: usersModule.id },
  });

  const oldRolesMenu = await prisma.menu.findUnique({
    where: { code: 'system-management.roles' },
    select: { id: true },
  });
  if (oldRolesMenu && oldRolesMenu.id !== rolesMenu.id) {
    const oldLinks = await prisma.roleMenu.findMany({
      where: { menuId: oldRolesMenu.id },
      select: { roleId: true },
    });
    if (oldLinks.length) {
      await prisma.roleMenu.createMany({
        data: oldLinks.map((link) => ({
          roleId: link.roleId,
          menuId: rolesMenu.id,
        })),
        skipDuplicates: true,
      });
    }
    await prisma.roleMenu.deleteMany({ where: { menuId: oldRolesMenu.id } });
    await prisma.menu.delete({ where: { id: oldRolesMenu.id } });
  }

  const menus = await prisma.menu.findMany({ select: { id: true, code: true } });
  const menuByCode = new Map(menus.map((item) => [item.code, item.id]));
  const roles = await prisma.role.findMany({
    select: { id: true, code: true },
  });

  const codesByRole: Record<string, readonly string[]> = {
    ADMIN: adminMenuCodes(menus.map((item) => item.code)),
    ...DEFAULT_MENU_CODES_BY_ROLE,
  };

  for (const role of roles) {
    const codes = codesByRole[role.code];
    if (!codes) continue;
    const menuIds = codes
      .map((code) => menuByCode.get(code))
      .filter((id): id is string => Boolean(id));
    if (!menuIds.length) continue;
    await prisma.roleMenu.createMany({
      data: menuIds.map((menuId) => ({ roleId: role.id, menuId })),
      skipDuplicates: true,
    });
  }

  const forbiddenMine = new Set<string>(ADMIN_FORBIDDEN_MINE_MENU_CODES);
  const unassigned = menus.filter((item) => !forbiddenMine.has(item.code));
  const admin = roles.find((role) => role.code === 'ADMIN');
  if (admin) {
    const assigned = new Set(
      (
        await prisma.roleMenu.findMany({
          where: { menuId: { in: unassigned.map((item) => item.id) } },
          select: { menuId: true },
        })
      ).map((item) => item.menuId),
    );
    const missing = unassigned.filter((item) => !assigned.has(item.id));
    if (missing.length) {
      await prisma.roleMenu.createMany({
        data: missing.map((item) => ({ roleId: admin.id, menuId: item.id })),
        skipDuplicates: true,
      });
    }
  }

  console.log('users menus ready:', rolesMenu.path, newUserMenu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
