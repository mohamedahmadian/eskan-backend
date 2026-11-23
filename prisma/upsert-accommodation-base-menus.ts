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
    where: { code: 'accommodation' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول اسکان یا نقش مدیر یافت نشد');
  }

  const menus = [
    {
      code: 'accommodation.school-districts',
      nameKey: 'menus.schoolDistricts',
      path: '/school-districts',
      icon: 'school',
      sortOrder: 9,
    },
    {
      code: 'accommodation.types',
      nameKey: 'menus.accommodationTypeManagement',
      path: '/accommodation-types',
      icon: 'tags',
      sortOrder: 10,
    },
  ];

  const created = [];
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
    created.push(menu);
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
      update: {},
      create: { roleId: admin.id, menuId: menu.id },
    });
  }

  const leftover = await prisma.menu.findUnique({
    where: { code: 'accommodation.base-info' },
  });
  if (leftover) {
    const oldLinks = await prisma.roleMenu.findMany({
      where: { menuId: leftover.id },
      select: { roleId: true },
    });
    if (oldLinks.length) {
      await prisma.roleMenu.createMany({
        data: created.flatMap((menu) =>
          oldLinks.map((link) => ({
            roleId: link.roleId,
            menuId: menu.id,
          })),
        ),
        skipDuplicates: true,
      });
    }
    await prisma.roleMenu.deleteMany({ where: { menuId: leftover.id } });
    await prisma.menu.delete({ where: { id: leftover.id } });
  }

  console.log(
    'accommodation type and district menus ready:',
    created.map((item) => item.path).join(', '),
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
