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
  const menu = await prisma.menu.findUnique({
    where: { code: 'participations.home' },
  });
  if (!menu) {
    throw new Error('منوی مشارکت‌ها یافت نشد');
  }

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

  console.log(
    'participations.home granted to roles:',
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
