import "dotenv/config";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { geoSeed } from "./geo-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: { nameKey: "roles.admin" },
    create: { code: "ADMIN", nameKey: "roles.admin" },
  });

  const accommodationManagerRole = await prisma.role.upsert({
    where: { code: "ACCOMMODATION_MANAGER" },
    update: { nameKey: "roles.accommodationManager" },
    create: {
      code: "ACCOMMODATION_MANAGER",
      nameKey: "roles.accommodationManager",
    },
  });

  const caravanManagerRole = await prisma.role.upsert({
    where: { code: "CARAVAN_MANAGER" },
    update: { nameKey: "roles.caravanManager" },
    create: { code: "CARAVAN_MANAGER", nameKey: "roles.caravanManager" },
  });

  await prisma.role.upsert({
    where: { code: "PILGRIM" },
    update: { nameKey: "roles.pilgrim" },
    create: { code: "PILGRIM", nameKey: "roles.pilgrim" },
  });

  await prisma.role.upsert({
    where: { code: "HEADQUARTERS_REPRESENTATIVE" },
    update: { nameKey: "roles.headquartersRepresentative" },
    create: {
      code: "HEADQUARTERS_REPRESENTATIVE",
      nameKey: "roles.headquartersRepresentative",
    },
  });

  const dashboard = await prisma.navModule.upsert({
    where: { code: "dashboard" },
    update: {},
    create: {
      code: "dashboard",
      nameKey: "modules.dashboard",
      icon: "layout-dashboard",
      sortOrder: 1,
    },
  });

  const pilgrims = await prisma.navModule.upsert({
    where: { code: "pilgrims" },
    update: {},
    create: {
      code: "pilgrims",
      nameKey: "modules.pilgrims",
      icon: "users",
      sortOrder: 2,
    },
  });

  const caravans = await prisma.navModule.upsert({
    where: { code: "caravans" },
    update: {},
    create: {
      code: "caravans",
      nameKey: "modules.caravans",
      icon: "footprints",
      sortOrder: 3,
    },
  });

  const sms = await prisma.navModule.upsert({
    where: { code: "sms" },
    update: {},
    create: {
      code: "sms",
      nameKey: "modules.sms",
      icon: "message-square",
      sortOrder: 4,
    },
  });

  const baseInfo = await prisma.navModule.upsert({
    where: { code: "base-info" },
    update: {
      nameKey: "modules.baseInfo",
      icon: "database",
      sortOrder: 5,
    },
    create: {
      code: "base-info",
      nameKey: "modules.baseInfo",
      icon: "database",
      sortOrder: 5,
    },
  });

  const accommodation = await prisma.navModule.upsert({
    where: { code: "accommodation" },
    update: {
      nameKey: "modules.accommodation",
      icon: "building-2",
      sortOrder: 6,
    },
    create: {
      code: "accommodation",
      nameKey: "modules.accommodation",
      icon: "building-2",
      sortOrder: 6,
    },
  });

  const headquarters = await prisma.navModule.upsert({
    where: { code: "headquarters" },
    update: {
      nameKey: "modules.headquarters",
      icon: "landmark",
      sortOrder: 7,
    },
    create: {
      code: "headquarters",
      nameKey: "modules.headquarters",
      icon: "landmark",
      sortOrder: 7,
    },
  });

  const users = await prisma.navModule.upsert({
    where: { code: "users" },
    update: {},
    create: {
      code: "users",
      nameKey: "modules.users",
      icon: "user-cog",
      sortOrder: 10,
    },
  });

  const menus = [
    {
      code: "dashboard.overview",
      moduleId: dashboard.id,
      nameKey: "menus.overview",
      path: "/",
      icon: "home",
      sortOrder: 1,
    },
    {
      code: "pilgrims.list",
      moduleId: pilgrims.id,
      nameKey: "menus.pilgrimsList",
      path: "/pilgrims",
      icon: "users",
      sortOrder: 1,
    },
    {
      code: "caravans.list",
      moduleId: caravans.id,
      nameKey: "menus.caravansList",
      path: "/caravans",
      icon: "footprints",
      sortOrder: 1,
    },
    {
      code: "caravans.managers",
      moduleId: caravans.id,
      nameKey: "menus.caravanManagers",
      path: "/caravan-managers",
      icon: "user-round-cog",
      sortOrder: 2,
    },
    {
      code: "sms.settings",
      moduleId: sms.id,
      nameKey: "menus.smsSettings",
      path: "/sms/settings",
      icon: "settings",
      sortOrder: 1,
    },
    {
      code: "sms.send",
      moduleId: sms.id,
      nameKey: "menus.smsSend",
      path: "/sms/send",
      icon: "send",
      sortOrder: 2,
    },
    {
      code: "base-info.countries",
      moduleId: baseInfo.id,
      nameKey: "menus.countries",
      path: "/base-info/countries",
      icon: "globe",
      sortOrder: 1,
    },
    {
      code: "base-info.provinces",
      moduleId: baseInfo.id,
      nameKey: "menus.provinces",
      path: "/base-info/provinces",
      icon: "map",
      sortOrder: 2,
    },
    {
      code: "base-info.cities",
      moduleId: baseInfo.id,
      nameKey: "menus.cities",
      path: "/base-info/cities",
      icon: "map-pin",
      sortOrder: 3,
    },
    {
      code: "base-info.walking-routes",
      moduleId: baseInfo.id,
      nameKey: "menus.walkingRoutes",
      path: "/base-info/walking-routes",
      icon: "route",
      sortOrder: 4,
    },
    {
      code: "base-info.food-suppliers",
      moduleId: baseInfo.id,
      nameKey: "menus.foodSuppliers",
      path: "/base-info/food-suppliers",
      icon: "utensils-crossed",
      sortOrder: 5,
    },
    {
      code: "base-info.medical-centers",
      moduleId: baseInfo.id,
      nameKey: "menus.medicalCenters",
      path: "/base-info/medical-centers",
      icon: "hospital",
      sortOrder: 6,
    },
    {
      code: "base-info.red-crescents",
      moduleId: baseInfo.id,
      nameKey: "menus.redCrescents",
      path: "/base-info/red-crescents",
      icon: "heart-handshake",
      sortOrder: 7,
    },
    {
      code: "base-info.benefactors",
      moduleId: baseInfo.id,
      nameKey: "menus.benefactors",
      path: "/base-info/benefactors",
      icon: "hand-heart",
      sortOrder: 8,
    },
    {
      code: "headquarters.representatives",
      moduleId: headquarters.id,
      nameKey: "menus.headquartersRepresentatives",
      path: "/headquarters/representatives",
      icon: "user-round",
      sortOrder: 1,
    },
    {
      code: "users.list",
      moduleId: users.id,
      nameKey: "menus.usersList",
      path: "/users",
      icon: "user-cog",
      sortOrder: 1,
    },
    {
      code: "accommodation.managers",
      moduleId: accommodation.id,
      nameKey: "menus.accommodationManagers",
      path: "/accommodation-managers",
      icon: "user-round-check",
      sortOrder: 1,
    },
    {
      code: "accommodation.list",
      moduleId: accommodation.id,
      nameKey: "menus.accommodations",
      path: "/accommodations",
      icon: "building-2",
      sortOrder: 2,
    },
  ];

  const menuRecords = [];
  for (const menu of menus) {
    const record = await prisma.menu.upsert({
      where: { code: menu.code },
      update: {
        nameKey: menu.nameKey,
        path: menu.path,
        icon: menu.icon,
        sortOrder: menu.sortOrder,
        moduleId: menu.moduleId,
      },
      create: menu,
    });
    menuRecords.push(record);
  }

  for (const menu of menuRecords) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: { roleId: adminRole.id, menuId: menu.id },
      },
      update: {},
      create: { roleId: adminRole.id, menuId: menu.id },
    });
  }

  const managerMenuCodes = new Set(["dashboard.overview", "accommodation.list"]);
  for (const menu of menuRecords.filter((item) => managerMenuCodes.has(item.code))) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: accommodationManagerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: accommodationManagerRole.id, menuId: menu.id },
    });
  }

  const caravanMenuCodes = new Set(["dashboard.overview", "caravans.list"]);
  for (const menu of menuRecords.filter((item) => caravanMenuCodes.has(item.code))) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: caravanManagerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: caravanManagerRole.id, menuId: menu.id },
    });
  }

  await prisma.smsSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      endpoint: "http://service.pejvaksoft.com",
      senderNumber: "10009155191225",
      username: "pejvaksoft",
      password: "P@dd45465",
    },
  });

  await seedGeo();

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      firstName: "مدیر",
      lastName: "سامانه",
      fullName: "مدیر سامانه",
      locale: "fa",
      status: "ACTIVE",
    },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: adminRole.id },
    },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
}

async function seedGeo() {
  for (const country of geoSeed) {
    const record = await prisma.country.upsert({
      where: { iso2: country.iso2 },
      update: {
        iso3: country.iso3,
        phoneCode: country.phoneCode,
        nameFa: country.nameFa,
        nameEn: country.nameEn,
        sortOrder: country.sortOrder,
        isActive: true,
      },
      create: {
        iso2: country.iso2,
        iso3: country.iso3,
        phoneCode: country.phoneCode,
        nameFa: country.nameFa,
        nameEn: country.nameEn,
        sortOrder: country.sortOrder,
        isActive: true,
      },
    });

    for (const [provinceIndex, province] of country.provinces.entries()) {
      const provinceRecord = await prisma.province.upsert({
        where: {
          countryId_code: { countryId: record.id, code: province.code },
        },
        update: {
          nameFa: province.nameFa,
          nameEn: province.nameEn,
          sortOrder: provinceIndex + 1,
          isActive: true,
        },
        create: {
          countryId: record.id,
          code: province.code,
          nameFa: province.nameFa,
          nameEn: province.nameEn,
          sortOrder: provinceIndex + 1,
          isActive: true,
        },
      });

      for (const [cityIndex, city] of province.cities.entries()) {
        await prisma.city.upsert({
          where: {
            provinceId_code: {
              provinceId: provinceRecord.id,
              code: city.code,
            },
          },
          update: {
            nameFa: city.nameFa,
            nameEn: city.nameEn,
            sortOrder: cityIndex + 1,
            isActive: true,
          },
          create: {
            provinceId: provinceRecord.id,
            code: city.code,
            nameFa: city.nameFa,
            nameEn: city.nameEn,
            sortOrder: cityIndex + 1,
            isActive: true,
          },
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
