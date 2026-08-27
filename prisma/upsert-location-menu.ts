import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const locationModule = await prisma.navModule.upsert({
    where: { code: 'location' },
    update: {
      nameKey: 'modules.location',
      icon: 'map-pin',
      sortOrder: 4,
    },
    create: {
      code: 'location',
      nameKey: 'modules.location',
      icon: 'map-pin',
      sortOrder: 4,
    },
  });

  const registerMenu = await prisma.menu.upsert({
    where: { code: 'location.mine' },
    update: {
      nameKey: 'menus.myLocation',
      path: '/my-location',
      icon: 'map-pin',
      sortOrder: 1,
      moduleId: locationModule.id,
    },
    create: {
      code: 'location.mine',
      nameKey: 'menus.myLocation',
      path: '/my-location',
      icon: 'map-pin',
      sortOrder: 1,
      moduleId: locationModule.id,
    },
  });

  const historyMenu = await prisma.menu.upsert({
    where: { code: 'location.history' },
    update: {
      nameKey: 'menus.myLocationHistory',
      path: '/my-location/history',
      icon: 'history',
      sortOrder: 2,
      moduleId: locationModule.id,
    },
    create: {
      code: 'location.history',
      nameKey: 'menus.myLocationHistory',
      path: '/my-location/history',
      icon: 'history',
      sortOrder: 2,
      moduleId: locationModule.id,
    },
  });

  const pilgrim = await prisma.role.findUnique({ where: { code: 'PILGRIM' } });
  const caravanManager = await prisma.role.findUnique({
    where: { code: 'CARAVAN_MANAGER' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!pilgrim || !caravanManager || !admin) {
    throw new Error('نقش زائر، مدیر کاروان یا مدیر یافت نشد');
  }

  for (const menu of [registerMenu, historyMenu]) {
    for (const role of [pilgrim, caravanManager]) {
      await prisma.roleMenu.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: {},
        create: { roleId: role.id, menuId: menu.id },
      });
    }
    await prisma.roleMenu.deleteMany({
      where: { roleId: admin.id, menuId: menu.id },
    });
  }

  console.log('location menus ready:', registerMenu.path, historyMenu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
