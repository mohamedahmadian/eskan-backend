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
    where: { code: 'participations.goods-report' },
    update: {
      nameKey: 'menus.contributionsGoodsReport',
      path: '/participations/goods-report',
      icon: 'package',
      sortOrder: 4,
      moduleId: module.id,
    },
    create: {
      code: 'participations.goods-report',
      nameKey: 'menus.contributionsGoodsReport',
      path: '/participations/goods-report',
      icon: 'package',
      sortOrder: 4,
      moduleId: module.id,
    },
  });

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
    update: {},
    create: { roleId: admin.id, menuId: menu.id },
  });

  const laterMenus = [
    { code: 'participations.campaigns', sortOrder: 5 },
    { code: 'participations.goods', sortOrder: 6 },
    { code: 'participations.goods-units', sortOrder: 7 },
    { code: 'participations.bank-accounts', sortOrder: 8 },
    { code: 'participations.crypto-wallets', sortOrder: 9 },
  ];
  for (const item of laterMenus) {
    await prisma.menu.updateMany({
      where: { code: item.code },
      data: { sortOrder: item.sortOrder },
    });
  }

  console.log('participations goods-report menu ready:', menu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
