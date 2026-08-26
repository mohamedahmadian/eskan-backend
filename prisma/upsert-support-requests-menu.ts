import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const module = await prisma.navModule.findUnique({
    where: { code: 'caravans' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول زیارت یا نقش مدیر یافت نشد');
  }

  const officer = await prisma.role.upsert({
    where: { code: 'GOVERNMENT_ORG_OFFICER' },
    update: { nameKey: 'roles.governmentOrgOfficer' },
    create: {
      code: 'GOVERNMENT_ORG_OFFICER',
      nameKey: 'roles.governmentOrgOfficer',
    },
  });

  const listMenu = await prisma.menu.upsert({
    where: { code: 'caravans.support-requests' },
    update: {
      nameKey: 'menus.supportRequests',
      path: '/support-requests',
      icon: 'hand-heart',
      sortOrder: 10,
      moduleId: module.id,
    },
    create: {
      code: 'caravans.support-requests',
      nameKey: 'menus.supportRequests',
      path: '/support-requests',
      icon: 'hand-heart',
      sortOrder: 10,
      moduleId: module.id,
    },
  });

  const reportMenu = await prisma.menu.upsert({
    where: { code: 'caravans.support-request-report' },
    update: {
      nameKey: 'menus.supportRequestReport',
      path: '/support-request-report',
      icon: 'chart-column',
      sortOrder: 11,
      moduleId: module.id,
    },
    create: {
      code: 'caravans.support-request-report',
      nameKey: 'menus.supportRequestReport',
      path: '/support-request-report',
      icon: 'chart-column',
      sortOrder: 11,
      moduleId: module.id,
    },
  });

  for (const menu of [listMenu, reportMenu]) {
    for (const role of [admin, officer]) {
      await prisma.roleMenu.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: {},
        create: { roleId: role.id, menuId: menu.id },
      });
    }
  }

  const overview = await prisma.menu.findUnique({
    where: { code: 'dashboard.overview' },
  });
  if (overview) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: { roleId: officer.id, menuId: overview.id },
      },
      update: {},
      create: { roleId: officer.id, menuId: overview.id },
    });
  }

  const allowed = new Set([
    'dashboard.overview',
    'caravans.support-requests',
    'caravans.support-request-report',
  ]);
  const extra = await prisma.roleMenu.findMany({
    where: { roleId: officer.id },
    include: { menu: { select: { id: true, code: true } } },
  });
  const extraIds = extra
    .filter((item) => !allowed.has(item.menu.code))
    .map((item) => item.menu.id);
  if (extraIds.length) {
    await prisma.roleMenu.deleteMany({
      where: { roleId: officer.id, menuId: { in: extraIds } },
    });
  }

  console.log('support-requests menus ready:', listMenu.path, reportMenu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
