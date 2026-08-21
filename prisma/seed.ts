import "dotenv/config";
import { join } from "node:path";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { geoSeed } from "./geo-data";
import {
  codeFromNeshanSlug,
  displayCityNameFa,
  loadIranProvincesAndCitiesNeshan,
  matchCity,
  nameEnFromNeshanSlug,
  uniqueCityCode,
  type IranCityNeshan,
} from "./iran-neshan";

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

  const pilgrimRole = await prisma.role.upsert({
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
    update: {
      nameKey: "modules.sms",
      icon: "message-square",
      sortOrder: 5,
    },
    create: {
      code: "sms",
      nameKey: "modules.sms",
      icon: "message-square",
      sortOrder: 5,
    },
  });

  const baseInfo = await prisma.navModule.upsert({
    where: { code: "base-info" },
    update: {
      nameKey: "modules.baseInfo",
      icon: "database",
      sortOrder: 6,
    },
    create: {
      code: "base-info",
      nameKey: "modules.baseInfo",
      icon: "database",
      sortOrder: 6,
    },
  });

  const accommodation = await prisma.navModule.upsert({
    where: { code: "accommodation" },
    update: {
      nameKey: "modules.accommodation",
      icon: "building-2",
      sortOrder: 4,
    },
    create: {
      code: "accommodation",
      nameKey: "modules.accommodation",
      icon: "building-2",
      sortOrder: 4,
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

  const logistics = await prisma.navModule.upsert({
    where: { code: "logistics" },
    update: {
      nameKey: "modules.logistics",
      icon: "package",
      sortOrder: 8,
    },
    create: {
      code: "logistics",
      nameKey: "modules.logistics",
      icon: "package",
      sortOrder: 8,
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
      code: "caravans.mine",
      moduleId: caravans.id,
      nameKey: "menus.myCaravans",
      path: "/my-caravans",
      icon: "tent",
      sortOrder: 2,
    },
    {
      code: "caravans.managers",
      moduleId: caravans.id,
      nameKey: "menus.caravanManagers",
      path: "/caravan-managers",
      icon: "user-round-cog",
      sortOrder: 3,
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
      code: "sms.report",
      moduleId: sms.id,
      nameKey: "menus.smsReport",
      path: "/sms/report",
      icon: "clipboard-list",
      sortOrder: 3,
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
    {
      code: "accommodation.report",
      moduleId: accommodation.id,
      nameKey: "menus.accommodationReport",
      path: "/accommodation-report",
      icon: "chart-column",
      sortOrder: 3,
    },
    {
      code: "logistics.suppliers",
      moduleId: logistics.id,
      nameKey: "menus.suppliers",
      path: "/logistics/suppliers",
      icon: "store",
      sortOrder: 1,
    },
    {
      code: "logistics.loans",
      moduleId: logistics.id,
      nameKey: "menus.loanManagement",
      path: "/logistics/loans",
      icon: "package-open",
      sortOrder: 2,
    },
    {
      code: "logistics.loan-report",
      moduleId: logistics.id,
      nameKey: "menus.loanReport",
      path: "/logistics/loan-report",
      icon: "chart-column",
      sortOrder: 3,
    },
    {
      code: "logistics.item-quotas",
      moduleId: logistics.id,
      nameKey: "menus.itemQuotas",
      path: "/logistics/item-quotas",
      icon: "boxes",
      sortOrder: 4,
    },
    {
      code: "logistics.issue-voucher",
      moduleId: logistics.id,
      nameKey: "menus.issueVoucher",
      path: "/logistics/issue-voucher",
      icon: "ticket",
      sortOrder: 5,
    },
    {
      code: "logistics.vouchers",
      moduleId: logistics.id,
      nameKey: "menus.voucherManagement",
      path: "/logistics/vouchers",
      icon: "clipboard-list",
      sortOrder: 6,
    },
    {
      code: "logistics.voucher-report",
      moduleId: logistics.id,
      nameKey: "menus.voucherReport",
      path: "/logistics/voucher-report",
      icon: "chart-column",
      sortOrder: 7,
    },
    {
      code: "logistics.my-vouchers",
      moduleId: logistics.id,
      nameKey: "menus.myVouchers",
      path: "/logistics/my-vouchers",
      icon: "scroll-text",
      sortOrder: 8,
    },
    {
      code: "logistics.my-loans",
      moduleId: logistics.id,
      nameKey: "menus.myLoans",
      path: "/logistics/my-loans",
      icon: "package-check",
      sortOrder: 9,
    },
    {
      code: "logistics.settings",
      moduleId: logistics.id,
      nameKey: "menus.logisticsSettings",
      path: "/logistics/settings",
      icon: "settings",
      sortOrder: 10,
    },
    {
      code: "logistics.ice-vouchers",
      moduleId: logistics.id,
      nameKey: "menus.iceVouchers",
      path: "/logistics/ice-vouchers",
      icon: "snowflake",
      sortOrder: 11,
    },
    {
      code: "logistics.my-ice-vouchers",
      moduleId: logistics.id,
      nameKey: "menus.myIceVouchers",
      path: "/logistics/my-ice-vouchers",
      icon: "snowflake",
      sortOrder: 12,
    },
    {
      code: "logistics.ice-voucher-report",
      moduleId: logistics.id,
      nameKey: "menus.iceVoucherReport",
      path: "/logistics/ice-voucher-report",
      icon: "chart-column",
      sortOrder: 13,
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

  const managerMenuCodes = new Set([
    "dashboard.overview",
    "accommodation.list",
    "accommodation.report",
    "logistics.my-vouchers",
    "logistics.my-loans",
    "logistics.my-ice-vouchers",
  ]);
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

  const caravanMenuCodes = new Set(["dashboard.overview", "caravans.mine"]);
  const caravanListMenu = menuRecords.find((item) => item.code === "caravans.list");
  if (caravanListMenu) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: caravanManagerRole.id,
        menuId: caravanListMenu.id,
      },
    });
  }
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

  const pilgrimMenuCodes = new Set(["dashboard.overview", "caravans.mine"]);
  for (const menu of menuRecords.filter((item) => pilgrimMenuCodes.has(item.code))) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: pilgrimRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: pilgrimRole.id, menuId: menu.id },
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

  await prisma.iceVoucherSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      moldsPer50Pilgrims: 1,
      costPerMold: 0,
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

function loadIranNeshanData() {
  return loadIranProvincesAndCitiesNeshan(
    join(__dirname, "iran_provinces_and_cities_neshan.csv"),
  );
}

async function applyIranCityNeshan(provinceId: string, rows: IranCityNeshan[]) {
  const existing = await prisma.city.findMany({
    where: { provinceId },
    select: {
      id: true,
      code: true,
      nameFa: true,
      sortOrder: true,
    },
  });
  const usedCodes = new Set(existing.map((city) => city.code));
  const matchedIds = new Set<string>();
  let nextSortOrder =
    existing.reduce((max, city) => Math.max(max, city.sortOrder), 0) + 1;

  await prisma.city.updateMany({
    where: { provinceId },
    data: { isProvinceCapital: false },
  });

  for (const row of rows) {
    const unmatched = existing.filter((city) => !matchedIds.has(city.id));
    const match = matchCity(unmatched, row) ?? matchCity(existing, row);

    if (match && !matchedIds.has(match.id)) {
      await prisma.city.update({
        where: { id: match.id },
        data: {
          neshanAddress: row.neshanAddress,
          latitude: row.latitude,
          longitude: row.longitude,
          isProvinceCapital: row.isProvinceCapital,
        },
      });
      matchedIds.add(match.id);
      continue;
    }

    const code = uniqueCityCode(codeFromNeshanSlug(row.slug), usedCodes);
    const created = await prisma.city.create({
      data: {
        provinceId,
        code,
        nameFa: displayCityNameFa(row.nameFa),
        nameEn: nameEnFromNeshanSlug(row.slug) || displayCityNameFa(row.nameFa),
        neshanAddress: row.neshanAddress,
        latitude: row.latitude,
        longitude: row.longitude,
        isProvinceCapital: row.isProvinceCapital,
        sortOrder: nextSortOrder,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        nameFa: true,
        sortOrder: true,
      },
    });
    existing.push(created);
    usedCodes.add(created.code);
    matchedIds.add(created.id);
    nextSortOrder += 1;
  }
}

async function seedGeo() {
  const iranNeshan = loadIranNeshanData();

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
      const location =
        country.iso2 === "IR"
          ? iranNeshan.provinces.get(province.nameFa)
          : undefined;
      if (country.iso2 === "IR" && !location) {
        throw new Error(
          `Neshan location missing for Iranian province: ${province.nameFa}`,
        );
      }

      const provinceRecord = await prisma.province.upsert({
        where: {
          countryId_code: { countryId: record.id, code: province.code },
        },
        update: {
          nameFa: province.nameFa,
          nameEn: province.nameEn,
          sortOrder: provinceIndex + 1,
          isActive: true,
          ...(location
            ? {
                neshanAddress: location.neshanAddress,
                latitude: location.latitude,
                longitude: location.longitude,
              }
            : {}),
        },
        create: {
          countryId: record.id,
          code: province.code,
          nameFa: province.nameFa,
          nameEn: province.nameEn,
          sortOrder: provinceIndex + 1,
          isActive: true,
          ...(location
            ? {
                neshanAddress: location.neshanAddress,
                latitude: location.latitude,
                longitude: location.longitude,
              }
            : {}),
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

      if (country.iso2 === "IR") {
        const cityRows = iranNeshan.citiesByProvince.get(province.nameFa) ?? [];
        if (cityRows.length === 0) {
          throw new Error(
            `Neshan city rows missing for Iranian province: ${province.nameFa}`,
          );
        }
        await applyIranCityNeshan(provinceRecord.id, cityRows);
      }
    }
  }

  const iranNames = new Set(
    geoSeed.find((country) => country.iso2 === "IR")?.provinces.map(
      (province) => province.nameFa,
    ) ?? [],
  );
  for (const nameFa of iranNeshan.provinces.keys()) {
    if (!iranNames.has(nameFa)) {
      throw new Error(`Neshan CSV province not in geo seed: ${nameFa}`);
    }
  }
  for (const nameFa of iranNeshan.citiesByProvince.keys()) {
    if (!iranNames.has(nameFa)) {
      throw new Error(`Neshan CSV city province not in geo seed: ${nameFa}`);
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
