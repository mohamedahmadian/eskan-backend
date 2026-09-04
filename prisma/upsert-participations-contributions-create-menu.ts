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
    where: { code: 'participations' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول مشارکت‌ها یا نقش مدیر یافت نشد');
  }

  const menu = await prisma.menu.upsert({
    where: { code: 'participations.contributions-create' },
    update: {
      nameKey: 'menus.contributionsCreate',
      path: '/participations/contributions/new',
      icon: 'hand-coins',
      sortOrder: 2,
      moduleId: module.id,
    },
    create: {
      code: 'participations.contributions-create',
      nameKey: 'menus.contributionsCreate',
      path: '/participations/contributions/new',
      icon: 'hand-coins',
      sortOrder: 2,
      moduleId: module.id,
    },
  });

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
    update: {},
    create: { roleId: admin.id, menuId: menu.id },
  });

  const laterMenus = [
    { code: 'participations.contributions', sortOrder: 3 },
    { code: 'participations.report', sortOrder: 4 },
    { code: 'participations.goods-report', sortOrder: 5 },
    { code: 'participations.campaigns', sortOrder: 6 },
    { code: 'participations.goods', sortOrder: 7 },
    { code: 'participations.goods-units', sortOrder: 8 },
    { code: 'participations.bank-accounts', sortOrder: 9 },
    { code: 'participations.crypto-wallets', sortOrder: 10 },
  ];
  for (const item of laterMenus) {
    await prisma.menu.updateMany({
      where: { code: item.code },
      data: { sortOrder: item.sortOrder },
    });
  }

  console.log('participations contributions-create menu ready:', menu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
