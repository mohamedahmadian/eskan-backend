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
    where: { code: 'base-info' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  const pilgrim = await prisma.role.findUnique({ where: { code: 'PILGRIM' } });
  if (!module || !admin) {
    throw new Error('ماژول اطلاعات پایه یا نقش مدیر یافت نشد');
  }

  const placesMenu = await prisma.menu.upsert({
    where: { code: 'base-info.places' },
    update: {
      nameKey: 'menus.places',
      path: '/base-info/places',
      icon: 'landmark',
      sortOrder: 11,
      moduleId: module.id,
    },
    create: {
      code: 'base-info.places',
      moduleId: module.id,
      nameKey: 'menus.places',
      path: '/base-info/places',
      icon: 'landmark',
      sortOrder: 11,
    },
  });

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: admin.id, menuId: placesMenu.id } },
    update: {},
    create: { roleId: admin.id, menuId: placesMenu.id },
  });

  for (const code of [
    'base-info.place-types',
    'base-info.medical-centers',
    'base-info.red-crescents',
  ]) {
    const leftover = await prisma.menu.findUnique({ where: { code } });
    if (leftover) {
      await prisma.roleMenu.deleteMany({ where: { menuId: leftover.id } });
      await prisma.menu.delete({ where: { id: leftover.id } });
    }
  }

  await prisma.placeType.upsert({
    where: { code: 'red-crescent' },
    update: {
      nameFa: 'هلال احمر',
      nameEn: 'Red Crescent',
      icon: 'heart-handshake',
      sortOrder: 7,
    },
    create: {
      code: 'red-crescent',
      nameFa: 'هلال احمر',
      nameEn: 'Red Crescent',
      icon: 'heart-handshake',
      sortOrder: 7,
    },
  });

  if (pilgrim) {
    await prisma.roleMenu.deleteMany({
      where: { roleId: pilgrim.id, menuId: placesMenu.id },
    });
  }

  console.log('places menu ready:', placesMenu.path);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
