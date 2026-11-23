import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

const ROLE_CODES = [
  'ADMIN',
  'ACCOMMODATION_MANAGER',
  'CARAVAN_MANAGER',
  'GROUP_MANAGER',
  'PILGRIM',
  'HONORARY_SERVANT',
  'LICENSE_ISSUER',
  'GOVERNMENT_ORG_OFFICER',
  'UNIT_MANAGER',
  'STATION_MANAGER',
  'HEADQUARTERS_REPRESENTATIVE',
];

async function main() {
  const module = await prisma.navModule.findUnique({
    where: { code: 'participations' },
  });
  if (!module) {
    throw new Error('ماژول مشارکت‌ها یافت نشد');
  }

  const menu = await prisma.menu.upsert({
    where: { code: 'participations.in-kind' },
    update: {
      nameKey: 'menus.participationsInKind',
      path: '/participations/in-kind',
      icon: 'gift',
      sortOrder: 8,
      moduleId: module.id,
    },
    create: {
      code: 'participations.in-kind',
      nameKey: 'menus.participationsInKind',
      path: '/participations/in-kind',
      icon: 'gift',
      sortOrder: 8,
      moduleId: module.id,
    },
  });

  const roles = await prisma.role.findMany({
    where: { code: { in: ROLE_CODES } },
  });

  for (const role of roles) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
      update: {},
      create: { roleId: role.id, menuId: menu.id },
    });
  }

  const laterMenus = [
    { code: 'participations.goods', sortOrder: 9 },
    { code: 'participations.goods-units', sortOrder: 10 },
    { code: 'participations.bank-accounts', sortOrder: 11 },
    { code: 'participations.crypto-wallets', sortOrder: 12 },
  ];
  for (const item of laterMenus) {
    await prisma.menu.updateMany({
      where: { code: item.code },
      data: { sortOrder: item.sortOrder },
    });
  }

  console.log(
    'participations.in-kind menu ready:',
    menu.path,
    'roles:',
    roles.map((role) => role.code).join(', '),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
