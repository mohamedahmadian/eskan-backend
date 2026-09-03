import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedParticipationsData } from './seed-participations-data';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  const pilgrim = await prisma.role.findUnique({ where: { code: 'PILGRIM' } });
  if (!admin) {
    throw new Error('نقش مدیر یافت نشد');
  }

  const module = await prisma.navModule.upsert({
    where: { code: 'participations' },
    update: {
      nameKey: 'modules.participations',
      icon: 'heart-handshake',
      sortOrder: 8,
    },
    create: {
      code: 'participations',
      nameKey: 'modules.participations',
      icon: 'heart-handshake',
      sortOrder: 8,
    },
  });

  const menus = [
    {
      code: 'participations.home',
      nameKey: 'menus.participationsHome',
      path: '/participations',
      icon: 'heart-handshake',
      sortOrder: 1,
    },
    {
      code: 'participations.campaigns',
      nameKey: 'menus.participationCampaigns',
      path: '/participations/campaigns',
      icon: 'megaphone',
      sortOrder: 2,
    },
    {
      code: 'participations.bank-accounts',
      nameKey: 'menus.bankAccounts',
      path: '/participations/bank-accounts',
      icon: 'landmark',
      sortOrder: 3,
    },
    {
      code: 'participations.crypto-wallets',
      nameKey: 'menus.cryptoWallets',
      path: '/participations/crypto-wallets',
      icon: 'wallet',
      sortOrder: 4,
    },
  ];

  for (const item of menus) {
    const menu = await prisma.menu.upsert({
      where: { code: item.code },
      update: {
        nameKey: item.nameKey,
        path: item.path,
        icon: item.icon,
        sortOrder: item.sortOrder,
        moduleId: module.id,
      },
      create: {
        ...item,
        moduleId: module.id,
      },
    });
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
      update: {},
      create: { roleId: admin.id, menuId: menu.id },
    });
    if (pilgrim && item.code === 'participations.campaigns') {
      await prisma.roleMenu.upsert({
        where: { roleId_menuId: { roleId: pilgrim.id, menuId: menu.id } },
        update: {},
        create: { roleId: pilgrim.id, menuId: menu.id },
      });
    } else if (pilgrim) {
      await prisma.roleMenu.deleteMany({
        where: { roleId: pilgrim.id, menuId: menu.id },
      });
    }
  }

  await seedParticipationsData(prisma);
  console.log('participations menus and sample data ready');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
