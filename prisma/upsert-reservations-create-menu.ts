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
  const pilgrim = await prisma.role.findUnique({ where: { code: 'PILGRIM' } });
  const caravanManager = await prisma.role.findUnique({
    where: { code: 'CARAVAN_MANAGER' },
  });
  const groupManager = await prisma.role.findUnique({
    where: { code: 'GROUP_MANAGER' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !pilgrim || !caravanManager || !groupManager || !admin) {
    throw new Error('ماژول زیارت یا نقش زائر/مدیر کاروان/مدیر گروه/مدیر یافت نشد');
  }

  const menu = await prisma.menu.upsert({
    where: { code: 'reservations.create' },
    update: {
      nameKey: 'menus.tasharofMashhad',
      path: '/my-reservations/new',
      icon: 'landmark',
      sortOrder: 0,
      moduleId: module.id,
    },
    create: {
      code: 'reservations.create',
      nameKey: 'menus.tasharofMashhad',
      path: '/my-reservations/new',
      icon: 'landmark',
      sortOrder: 0,
      moduleId: module.id,
    },
  });

  for (const role of [pilgrim, caravanManager, groupManager]) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
      update: {},
      create: { roleId: role.id, menuId: menu.id },
    });
  }

  await prisma.roleMenu.deleteMany({
    where: { roleId: admin.id, menuId: menu.id },
  });

  console.log('reservations.create menu ready:', menu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
