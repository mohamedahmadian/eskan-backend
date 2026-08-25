import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const module = await prisma.navModule.findUnique({ where: { code: 'caravans' } });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول زیارت یا نقش مدیر یافت نشد');
  }

  const menu = await prisma.menu.upsert({
    where: { code: 'reception.desk' },
    update: {
      nameKey: 'menus.reception',
      path: '/reception',
      icon: 'scan-search',
      sortOrder: 4,
      moduleId: module.id,
    },
    create: {
      code: 'reception.desk',
      nameKey: 'menus.reception',
      path: '/reception',
      icon: 'scan-search',
      sortOrder: 4,
      moduleId: module.id,
    },
  });

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
    update: {},
    create: { roleId: admin.id, menuId: menu.id },
  });

  await prisma.menu.updateMany({
    where: { code: 'reservations.list' },
    data: { sortOrder: 5 },
  });
  await prisma.menu.updateMany({
    where: { code: 'reservations.stats' },
    data: { sortOrder: 6 },
  });
  await prisma.menu.updateMany({
    where: { code: 'reception.settings' },
    data: { sortOrder: 7 },
  });

  console.log('reception.desk menu ready:', menu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
