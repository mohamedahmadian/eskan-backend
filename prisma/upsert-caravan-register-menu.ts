import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const caravanModule = await prisma.navModule.findUnique({
    where: { code: 'caravan-management' },
  });
  const dashboard = await prisma.navModule.findUnique({
    where: { code: 'dashboard' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!caravanModule || !dashboard || !admin) {
    throw new Error('ماژول مدیریت کاروان، داشبورد یا نقش مدیر یافت نشد');
  }

  const menus = [
    {
      code: 'caravans.register',
      nameKey: 'menus.caravanRegister',
      path: '/caravan-registration',
      icon: 'tent',
      sortOrder: 5,
      moduleId: caravanModule.id,
    },
    {
      code: 'dashboard.new-caravan',
      nameKey: 'menus.newCaravan',
      path: '/caravan-registration',
      icon: 'tent',
      sortOrder: 2,
      moduleId: dashboard.id,
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
        moduleId: item.moduleId,
      },
      create: item,
    });
    console.log(item.code, 'ready:', menu.path);
  }

  await prisma.menu.update({
    where: { code: 'caravans.mine' },
    data: { moduleId: caravanModule.id, sortOrder: 6 },
  });

  const shared = await prisma.menu.findMany({
    where: {
      code: { in: ['dashboard.new-caravan', 'caravans.register', 'caravans.mine'] },
    },
  });
  const roles = await prisma.role.findMany({ select: { id: true, code: true } });
  for (const role of roles) {
    for (const menu of shared) {
      await prisma.roleMenu.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: {},
        create: { roleId: role.id, menuId: menu.id },
      });
    }
  }
  console.log(
    'shared caravan menus granted to',
    roles.map((role) => role.code).join(', '),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
