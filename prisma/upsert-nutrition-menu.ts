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
    where: { code: 'logistics' },
  });
  const admin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!module || !admin) {
    throw new Error('ماژول تدارکات و پشتیبانی یا نقش مدیر یافت نشد');
  }

  const menus = [
    {
      code: 'logistics.ingredients',
      nameKey: 'menus.ingredientManagement',
      path: '/logistics/ingredients',
      icon: 'wheat',
      sortOrder: 14,
    },
    {
      code: 'logistics.foods',
      nameKey: 'menus.foodManagement',
      path: '/logistics/foods',
      icon: 'utensils-crossed',
      sortOrder: 15,
    },
    {
      code: 'logistics.warehouse-calculator',
      nameKey: 'menus.warehouseCalculator',
      path: '/logistics/warehouse-calculator',
      icon: 'calculator',
      sortOrder: 16,
    },
    {
      code: 'logistics.restaurants',
      nameKey: 'menus.restaurantManagement',
      path: '/logistics/restaurants',
      icon: 'cooking-pot',
      sortOrder: 17,
    },
    {
      code: 'logistics.restaurant-meal-plans',
      nameKey: 'menus.restaurantMealPlan',
      path: '/logistics/restaurant-meal-plans',
      icon: 'calendar-range',
      sortOrder: 18,
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
  }

  console.log('nutrition menus ready:', menus.map((item) => item.path).join(', '));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
