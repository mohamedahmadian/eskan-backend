import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedHeadquartersContent } from './seed-headquarters-content';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

async function main() {
  const module = await prisma.navModule.findUnique({
    where: { code: 'headquarters' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول ستاد جمعیت یا نقش مدیر یافت نشد');
  }

  const newsMenu = await prisma.menu.upsert({
    where: { code: 'headquarters.news' },
    update: {
      nameKey: 'menus.headquartersNews',
      path: '/headquarters/news',
      icon: 'newspaper',
      sortOrder: 5,
      moduleId: module.id,
    },
    create: {
      code: 'headquarters.news',
      nameKey: 'menus.headquartersNews',
      path: '/headquarters/news',
      icon: 'newspaper',
      sortOrder: 5,
      moduleId: module.id,
    },
  });

  const announcementsMenu = await prisma.menu.upsert({
    where: { code: 'headquarters.announcements' },
    update: {
      nameKey: 'menus.headquartersAnnouncements',
      path: '/headquarters/announcements',
      icon: 'megaphone',
      sortOrder: 6,
      moduleId: module.id,
    },
    create: {
      code: 'headquarters.announcements',
      nameKey: 'menus.headquartersAnnouncements',
      path: '/headquarters/announcements',
      icon: 'megaphone',
      sortOrder: 6,
      moduleId: module.id,
    },
  });

  for (const menu of [newsMenu, announcementsMenu]) {
    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: admin.id, menuId: menu.id } },
      update: {},
      create: { roleId: admin.id, menuId: menu.id },
    });
  }

  await seedHeadquartersContent(prisma);

  console.log('headquarters news and announcements ready:', newsMenu.path, announcementsMenu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
