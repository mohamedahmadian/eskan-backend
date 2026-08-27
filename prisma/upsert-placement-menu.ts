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

  const menu = await prisma.menu.upsert({
    where: { code: 'accommodation.placement' },
    update: {
      nameKey: 'menus.placement',
      path: '/placements',
      icon: 'map-pin',
      sortOrder: 6,
      moduleId: module.id,
    },
    create: {
      code: 'accommodation.placement',
      nameKey: 'menus.placement',
      path: '/placements',
      icon: 'map-pin',
      sortOrder: 6,
      moduleId: module.id,
    },
  });

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
    update: {},
    create: { roleId: admin.id, menuId: menu.id },
  });

  await prisma.menu.updateMany({
    where: { code: 'reservations.stats' },
    data: { sortOrder: 7 },
  });
  await prisma.menu.updateMany({
    where: { code: 'caravans.provincial-monitoring' },
    data: { sortOrder: 8 },
  });
  await prisma.menu.updateMany({
    where: { code: 'caravans.national-monitoring' },
    data: { sortOrder: 9 },
  });
  await prisma.menu.updateMany({
    where: { code: 'reception.settings' },
    data: { sortOrder: 10 },
  });
  await prisma.menu.updateMany({
    where: { code: 'caravans.support-requests' },
    data: { sortOrder: 11 },
  });
  await prisma.menu.updateMany({
    where: { code: 'caravans.support-request-report' },
    data: { sortOrder: 12 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
