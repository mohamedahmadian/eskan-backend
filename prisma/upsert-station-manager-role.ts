import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const role = await prisma.role.upsert({
    where: { code: 'STATION_MANAGER' },
    update: { nameKey: 'roles.stationManager' },
    create: {
      code: 'STATION_MANAGER',
      nameKey: 'roles.stationManager',
    },
  });

  const dashboard = await prisma.navModule.findUnique({
    where: { code: 'dashboard' },
  });
  const honorary = await prisma.navModule.findUnique({
    where: { code: 'honorary-service' },
  });
  const stations = await prisma.navModule.upsert({
    where: { code: 'stations' },
    update: {
      nameKey: 'modules.stations',
      icon: 'milestone',
      sortOrder: 6,
    },
    create: {
      code: 'stations',
      nameKey: 'modules.stations',
      icon: 'milestone',
      sortOrder: 6,
    },
  });

  const menuSpecs = [
    dashboard
      ? {
          code: 'dashboard.overview',
          moduleId: dashboard.id,
          nameKey: 'menus.overview',
          path: '/',
          icon: 'home',
          sortOrder: 1,
        }
      : null,
    honorary
      ? {
          code: 'honorary-service.apply',
          moduleId: honorary.id,
          nameKey: 'menus.honoraryApply',
          path: '/honorary-apply',
          icon: 'hand-heart',
          sortOrder: 1,
        }
      : null,
    honorary
      ? {
          code: 'honorary-service.history',
          moduleId: honorary.id,
          nameKey: 'menus.honoraryHistory',
          path: '/honorary-history',
          icon: 'history',
          sortOrder: 2,
        }
      : null,
    {
      code: 'stations.mine',
      moduleId: stations.id,
      nameKey: 'menus.myWalkingStations',
      path: '/my-walking-stations',
      icon: 'milestone',
      sortOrder: 1,
    },
    {
      code: 'stations.report',
      moduleId: stations.id,
      nameKey: 'menus.stationReport',
      path: '/station-report',
      icon: 'chart-column',
      sortOrder: 2,
    },
    {
      code: 'stations.history',
      moduleId: stations.id,
      nameKey: 'menus.stationReservationHistory',
      path: '/station-reservation-history',
      icon: 'clipboard-list',
      sortOrder: 3,
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const allowedCodes = new Set(menuSpecs.map((item) => item.code));
  const menus = [];
  for (const spec of menuSpecs) {
    const menu = await prisma.menu.upsert({
      where: { code: spec.code },
      update: {
        nameKey: spec.nameKey,
        path: spec.path,
        icon: spec.icon,
        sortOrder: spec.sortOrder,
        moduleId: spec.moduleId,
      },
      create: spec,
    });
    menus.push(menu);
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: { roleId: role.id, menuId: menu.id },
      },
      update: {},
      create: { roleId: role.id, menuId: menu.id },
    });
  }

  const extra = await prisma.roleMenu.findMany({
    where: { roleId: role.id },
    include: { menu: { select: { code: true } } },
  });
  const extraIds = extra
    .filter((item) => !allowedCodes.has(item.menu.code))
    .map((item) => item.menuId);
  if (extraIds.length) {
    await prisma.roleMenu.deleteMany({
      where: { roleId: role.id, menuId: { in: extraIds } },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
