import 'dotenv/config';
import { join } from 'node:path';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { geoSeed } from './geo-data';
import {
  extraIranCities,
  loadOfficialIranCities,
} from './iran-official';
import {
  codeFromNeshanSlug,
  displayCityNameFa,
  loadIranProvincesAndCitiesNeshan,
  matchCity,
  nameEnFromNeshanSlug,
  uniqueCityCode,
  type IranCityNeshan,
} from './iran-neshan';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { nameKey: 'roles.admin' },
    create: { code: 'ADMIN', nameKey: 'roles.admin' },
  });

  const accommodationManagerRole = await prisma.role.upsert({
    where: { code: 'ACCOMMODATION_MANAGER' },
    update: { nameKey: 'roles.accommodationManager' },
    create: {
      code: 'ACCOMMODATION_MANAGER',
      nameKey: 'roles.accommodationManager',
    },
  });

  const caravanManagerRole = await prisma.role.upsert({
    where: { code: 'CARAVAN_MANAGER' },
    update: { nameKey: 'roles.caravanManager' },
    create: { code: 'CARAVAN_MANAGER', nameKey: 'roles.caravanManager' },
  });

  const groupManagerRole = await prisma.role.upsert({
    where: { code: 'GROUP_MANAGER' },
    update: { nameKey: 'roles.groupManager' },
    create: { code: 'GROUP_MANAGER', nameKey: 'roles.groupManager' },
  });

  const pilgrimRole = await prisma.role.upsert({
    where: { code: 'PILGRIM' },
    update: { nameKey: 'roles.pilgrim' },
    create: { code: 'PILGRIM', nameKey: 'roles.pilgrim' },
  });

  const headquartersRepresentativeRole = await prisma.role.upsert({
    where: { code: 'HEADQUARTERS_REPRESENTATIVE' },
    update: { nameKey: 'roles.headquartersRepresentative' },
    create: {
      code: 'HEADQUARTERS_REPRESENTATIVE',
      nameKey: 'roles.headquartersRepresentative',
    },
  });

  const licenseIssuerRole = await prisma.role.upsert({
    where: { code: 'LICENSE_ISSUER' },
    update: { nameKey: 'roles.licenseIssuer' },
    create: {
      code: 'LICENSE_ISSUER',
      nameKey: 'roles.licenseIssuer',
    },
  });

  const unitManagerRole = await prisma.role.upsert({
    where: { code: 'UNIT_MANAGER' },
    update: { nameKey: 'roles.unitManager' },
    create: {
      code: 'UNIT_MANAGER',
      nameKey: 'roles.unitManager',
    },
  });

  const governmentOrgOfficerRole = await prisma.role.upsert({
    where: { code: 'GOVERNMENT_ORG_OFFICER' },
    update: { nameKey: 'roles.governmentOrgOfficer' },
    create: {
      code: 'GOVERNMENT_ORG_OFFICER',
      nameKey: 'roles.governmentOrgOfficer',
    },
  });

  const dashboard = await prisma.navModule.upsert({
    where: { code: 'dashboard' },
    update: {},
    create: {
      code: 'dashboard',
      nameKey: 'modules.dashboard',
      icon: 'layout-dashboard',
      sortOrder: 1,
    },
  });

  const pilgrims = await prisma.navModule.upsert({
    where: { code: 'pilgrims' },
    update: {},
    create: {
      code: 'pilgrims',
      nameKey: 'modules.pilgrims',
      icon: 'users',
      sortOrder: 2,
    },
  });

  const caravans = await prisma.navModule.upsert({
    where: { code: 'caravans' },
    update: {
      nameKey: 'modules.caravans',
      icon: 'footprints',
      sortOrder: 3,
    },
    create: {
      code: 'caravans',
      nameKey: 'modules.caravans',
      icon: 'footprints',
      sortOrder: 3,
    },
  });

  const location = await prisma.navModule.upsert({
    where: { code: 'location' },
    update: {
      nameKey: 'modules.location',
      icon: 'map-pin',
      sortOrder: 4,
    },
    create: {
      code: 'location',
      nameKey: 'modules.location',
      icon: 'map-pin',
      sortOrder: 4,
    },
  });

  const caravanManagement = await prisma.navModule.upsert({
    where: { code: 'caravan-management' },
    update: {
      nameKey: 'modules.caravanManagement',
      icon: 'tent',
      sortOrder: 4,
    },
    create: {
      code: 'caravan-management',
      nameKey: 'modules.caravanManagement',
      icon: 'tent',
      sortOrder: 4,
    },
  });

  const groupManagement = await prisma.navModule.upsert({
    where: { code: 'group-management' },
    update: {
      nameKey: 'modules.groupManagement',
      icon: 'users-round',
      sortOrder: 5,
    },
    create: {
      code: 'group-management',
      nameKey: 'modules.groupManagement',
      icon: 'users-round',
      sortOrder: 5,
    },
  });

  const sms = await prisma.navModule.upsert({
    where: { code: 'sms' },
    update: {
      nameKey: 'modules.sms',
      icon: 'message-square',
      sortOrder: 6,
    },
    create: {
      code: 'sms',
      nameKey: 'modules.sms',
      icon: 'message-square',
      sortOrder: 6,
    },
  });

  const baseInfo = await prisma.navModule.upsert({
    where: { code: 'base-info' },
    update: {
      nameKey: 'modules.baseInfo',
      icon: 'database',
      sortOrder: 7,
    },
    create: {
      code: 'base-info',
      nameKey: 'modules.baseInfo',
      icon: 'database',
      sortOrder: 7,
    },
  });

  const accommodation = await prisma.navModule.upsert({
    where: { code: 'accommodation' },
    update: {
      nameKey: 'modules.accommodation',
      icon: 'building-2',
      sortOrder: 5,
    },
    create: {
      code: 'accommodation',
      nameKey: 'modules.accommodation',
      icon: 'building-2',
      sortOrder: 5,
    },
  });

  const headquarters = await prisma.navModule.upsert({
    where: { code: 'headquarters' },
    update: {
      nameKey: 'modules.headquarters',
      icon: 'landmark',
      sortOrder: 8,
    },
    create: {
      code: 'headquarters',
      nameKey: 'modules.headquarters',
      icon: 'landmark',
      sortOrder: 8,
    },
  });

  const logistics = await prisma.navModule.upsert({
    where: { code: 'logistics' },
    update: {
      nameKey: 'modules.logistics',
      icon: 'package',
      sortOrder: 9,
    },
    create: {
      code: 'logistics',
      nameKey: 'modules.logistics',
      icon: 'package',
      sortOrder: 9,
    },
  });

  const users = await prisma.navModule.upsert({
    where: { code: 'users' },
    update: {},
    create: {
      code: 'users',
      nameKey: 'modules.users',
      icon: 'user-cog',
      sortOrder: 10,
    },
  });

  const licenses = await prisma.navModule.upsert({
    where: { code: 'licenses' },
    update: {
      nameKey: 'modules.licenses',
      icon: 'stamp',
      sortOrder: 11,
    },
    create: {
      code: 'licenses',
      nameKey: 'modules.licenses',
      icon: 'stamp',
      sortOrder: 11,
    },
  });

  const evaluations = await prisma.navModule.upsert({
    where: { code: 'evaluations' },
    update: {
      nameKey: 'modules.evaluations',
      icon: 'clipboard-list',
      sortOrder: 12,
    },
    create: {
      code: 'evaluations',
      nameKey: 'modules.evaluations',
      icon: 'clipboard-list',
      sortOrder: 12,
    },
  });

  const menus = [
    {
      code: 'dashboard.overview',
      moduleId: dashboard.id,
      nameKey: 'menus.overview',
      path: '/',
      icon: 'home',
      sortOrder: 1,
    },
    {
      code: 'pilgrims.list',
      moduleId: pilgrims.id,
      nameKey: 'menus.pilgrimsList',
      path: '/pilgrims',
      icon: 'users',
      sortOrder: 1,
    },
    {
      code: 'pilgrims.report',
      moduleId: pilgrims.id,
      nameKey: 'menus.pilgrimsReport',
      path: '/pilgrim-report',
      icon: 'chart-column',
      sortOrder: 2,
    },
    {
      code: 'caravans.list',
      moduleId: caravanManagement.id,
      nameKey: 'menus.caravansList',
      path: '/caravans',
      icon: 'footprints',
      sortOrder: 1,
    },
    {
      code: 'caravans.managers',
      moduleId: caravanManagement.id,
      nameKey: 'menus.caravanManagers',
      path: '/caravan-managers',
      icon: 'user-round-cog',
      sortOrder: 2,
    },
    {
      code: 'caravans.year-management',
      moduleId: caravanManagement.id,
      nameKey: 'menus.caravanYearManagement',
      path: '/caravan-year-management',
      icon: 'calendar-range',
      sortOrder: 3,
    },
    {
      code: 'caravans.report',
      moduleId: caravanManagement.id,
      nameKey: 'menus.caravanReport',
      path: '/caravan-report',
      icon: 'chart-column',
      sortOrder: 4,
    },
    {
      code: 'groups.list',
      moduleId: groupManagement.id,
      nameKey: 'menus.groupsList',
      path: '/groups',
      icon: 'users-round',
      sortOrder: 1,
    },
    {
      code: 'reservations.mine',
      moduleId: caravans.id,
      nameKey: 'menus.myReservations',
      path: '/my-reservations',
      icon: 'scroll-text',
      sortOrder: 1,
    },
    {
      code: 'caravans.mine',
      moduleId: caravans.id,
      nameKey: 'menus.myCaravans',
      path: '/my-caravans',
      icon: 'tent',
      sortOrder: 2,
    },
    {
      code: 'groups.mine',
      moduleId: caravans.id,
      nameKey: 'menus.myGroups',
      path: '/my-groups',
      icon: 'users-round',
      sortOrder: 3,
    },
    {
      code: 'reception.desk',
      moduleId: caravans.id,
      nameKey: 'menus.reception',
      path: '/reception',
      icon: 'scan-search',
      sortOrder: 4,
    },
    {
      code: 'reservations.list',
      moduleId: caravans.id,
      nameKey: 'menus.reservationsAdmin',
      path: '/reservations',
      icon: 'clipboard-list',
      sortOrder: 5,
    },
    {
      code: 'accommodation.placement',
      moduleId: caravans.id,
      nameKey: 'menus.placement',
      path: '/placements',
      icon: 'map-pin',
      sortOrder: 6,
    },
    {
      code: 'reservations.stats',
      moduleId: caravans.id,
      nameKey: 'menus.reservationsReport',
      path: '/reservation-stats',
      icon: 'chart-column',
      sortOrder: 7,
    },
    {
      code: 'caravans.provincial-monitoring',
      moduleId: caravans.id,
      nameKey: 'menus.provincialMonitoring',
      path: '/provincial-monitoring',
      icon: 'map',
      sortOrder: 8,
    },
    {
      code: 'caravans.national-monitoring',
      moduleId: caravans.id,
      nameKey: 'menus.nationalMonitoring',
      path: '/national-monitoring',
      icon: 'chart-column',
      sortOrder: 9,
    },
    {
      code: 'reception.settings',
      moduleId: caravans.id,
      nameKey: 'menus.receptionSettings',
      path: '/reception-settings',
      icon: 'settings',
      sortOrder: 10,
    },
    {
      code: 'caravans.support-requests',
      moduleId: caravans.id,
      nameKey: 'menus.supportRequests',
      path: '/support-requests',
      icon: 'hand-heart',
      sortOrder: 11,
    },
    {
      code: 'caravans.support-request-report',
      moduleId: caravans.id,
      nameKey: 'menus.supportRequestReport',
      path: '/support-request-report',
      icon: 'chart-column',
      sortOrder: 12,
    },
    {
      code: 'location.mine',
      moduleId: location.id,
      nameKey: 'menus.myLocation',
      path: '/my-location',
      icon: 'map-pin',
      sortOrder: 1,
    },
    {
      code: 'location.history',
      moduleId: location.id,
      nameKey: 'menus.myLocationHistory',
      path: '/my-location/history',
      icon: 'history',
      sortOrder: 2,
    },
    {
      code: 'sms.settings',
      moduleId: sms.id,
      nameKey: 'menus.smsSettings',
      path: '/sms/settings',
      icon: 'settings',
      sortOrder: 1,
    },
    {
      code: 'sms.send',
      moduleId: sms.id,
      nameKey: 'menus.smsSend',
      path: '/sms/send',
      icon: 'send',
      sortOrder: 2,
    },
    {
      code: 'sms.report',
      moduleId: sms.id,
      nameKey: 'menus.smsReport',
      path: '/sms/report',
      icon: 'clipboard-list',
      sortOrder: 3,
    },
    {
      code: 'base-info.countries',
      moduleId: baseInfo.id,
      nameKey: 'menus.countries',
      path: '/base-info/countries',
      icon: 'globe',
      sortOrder: 1,
    },
    {
      code: 'base-info.provinces',
      moduleId: baseInfo.id,
      nameKey: 'menus.provinces',
      path: '/base-info/provinces',
      icon: 'map',
      sortOrder: 2,
    },
    {
      code: 'base-info.cities',
      moduleId: baseInfo.id,
      nameKey: 'menus.cities',
      path: '/base-info/cities',
      icon: 'map-pin',
      sortOrder: 3,
    },
    {
      code: 'base-info.entry-borders',
      moduleId: baseInfo.id,
      nameKey: 'menus.entryBorders',
      path: '/base-info/entry-borders',
      icon: 'fence',
      sortOrder: 4,
    },
    {
      code: 'base-info.walking-routes',
      moduleId: baseInfo.id,
      nameKey: 'menus.walkingRoutes',
      path: '/base-info/walking-routes',
      icon: 'route',
      sortOrder: 5,
    },
    {
      code: 'base-info.food-suppliers',
      moduleId: baseInfo.id,
      nameKey: 'menus.foodSuppliers',
      path: '/base-info/food-suppliers',
      icon: 'utensils-crossed',
      sortOrder: 6,
    },
    {
      code: 'base-info.benefactors',
      moduleId: baseInfo.id,
      nameKey: 'menus.benefactors',
      path: '/base-info/benefactors',
      icon: 'hand-heart',
      sortOrder: 7,
    },
    {
      code: 'base-info.government-organizations',
      moduleId: baseInfo.id,
      nameKey: 'menus.governmentOrganizations',
      path: '/base-info/government-organizations',
      icon: 'building',
      sortOrder: 10,
    },
    {
      code: 'base-info.places',
      moduleId: baseInfo.id,
      nameKey: 'menus.places',
      path: '/base-info/places',
      icon: 'landmark',
      sortOrder: 11,
    },
    {
      code: 'licenses.issue',
      moduleId: licenses.id,
      nameKey: 'menus.issueLicense',
      path: '/licenses/new',
      icon: 'stamp',
      sortOrder: 1,
    },
    {
      code: 'licenses.issued',
      moduleId: licenses.id,
      nameKey: 'menus.issuedLicenses',
      path: '/licenses/issued',
      icon: 'file-check',
      sortOrder: 2,
    },
    {
      code: 'headquarters.info',
      moduleId: headquarters.id,
      nameKey: 'menus.headquartersInfo',
      path: '/headquarters/info',
      icon: 'landmark',
      sortOrder: 0,
    },
    {
      code: 'headquarters.representatives',
      moduleId: headquarters.id,
      nameKey: 'menus.headquartersRepresentatives',
      path: '/headquarters/representatives',
      icon: 'user-round',
      sortOrder: 1,
    },
    {
      code: 'headquarters.units',
      moduleId: headquarters.id,
      nameKey: 'menus.orgUnits',
      path: '/headquarters/units',
      icon: 'building',
      sortOrder: 2,
    },
    {
      code: 'headquarters.accommodation-liaisons',
      moduleId: headquarters.id,
      nameKey: 'menus.unitAccommodationLiaisons',
      path: '/headquarters/accommodation-liaisons',
      icon: 'building-2',
      sortOrder: 3,
    },
    {
      code: 'headquarters.caravan-liaisons',
      moduleId: headquarters.id,
      nameKey: 'menus.unitCaravanLiaisons',
      path: '/headquarters/caravan-liaisons',
      icon: 'tent',
      sortOrder: 4,
    },
    {
      code: 'users.list',
      moduleId: users.id,
      nameKey: 'menus.usersList',
      path: '/users',
      icon: 'user-cog',
      sortOrder: 1,
    },
    {
      code: 'accommodation.mine',
      moduleId: accommodation.id,
      nameKey: 'menus.myAccommodations',
      path: '/my-accommodations',
      icon: 'building',
      sortOrder: 1,
    },
    {
      code: 'accommodation.managers',
      moduleId: accommodation.id,
      nameKey: 'menus.accommodationManagers',
      path: '/accommodation-managers',
      icon: 'user-round-check',
      sortOrder: 2,
    },
    {
      code: 'accommodation.list',
      moduleId: accommodation.id,
      nameKey: 'menus.accommodations',
      path: '/accommodations',
      icon: 'building-2',
      sortOrder: 3,
    },
    {
      code: 'accommodation.year-management',
      moduleId: accommodation.id,
      nameKey: 'menus.accommodationYearManagement',
      path: '/accommodation-year-management',
      icon: 'calendar-range',
      sortOrder: 4,
    },
    {
      code: 'accommodation.report',
      moduleId: accommodation.id,
      nameKey: 'menus.accommodationReport',
      path: '/accommodation-report',
      icon: 'chart-column',
      sortOrder: 5,
    },
    {
      code: 'logistics.suppliers',
      moduleId: logistics.id,
      nameKey: 'menus.suppliers',
      path: '/logistics/suppliers',
      icon: 'store',
      sortOrder: 1,
    },
    {
      code: 'logistics.loans',
      moduleId: logistics.id,
      nameKey: 'menus.loanManagement',
      path: '/logistics/loans',
      icon: 'package-open',
      sortOrder: 2,
    },
    {
      code: 'logistics.loan-report',
      moduleId: logistics.id,
      nameKey: 'menus.loanReport',
      path: '/logistics/loan-report',
      icon: 'chart-column',
      sortOrder: 3,
    },
    {
      code: 'logistics.item-quotas',
      moduleId: logistics.id,
      nameKey: 'menus.itemQuotas',
      path: '/logistics/item-quotas',
      icon: 'boxes',
      sortOrder: 4,
    },
    {
      code: 'logistics.issue-voucher',
      moduleId: logistics.id,
      nameKey: 'menus.issueVoucher',
      path: '/logistics/issue-voucher',
      icon: 'ticket',
      sortOrder: 5,
    },
    {
      code: 'logistics.vouchers',
      moduleId: logistics.id,
      nameKey: 'menus.voucherManagement',
      path: '/logistics/vouchers',
      icon: 'clipboard-list',
      sortOrder: 6,
    },
    {
      code: 'logistics.voucher-report',
      moduleId: logistics.id,
      nameKey: 'menus.voucherReport',
      path: '/logistics/voucher-report',
      icon: 'chart-column',
      sortOrder: 7,
    },
    {
      code: 'logistics.my-vouchers',
      moduleId: logistics.id,
      nameKey: 'menus.myVouchers',
      path: '/logistics/my-vouchers',
      icon: 'scroll-text',
      sortOrder: 8,
    },
    {
      code: 'logistics.my-loans',
      moduleId: logistics.id,
      nameKey: 'menus.myLoans',
      path: '/logistics/my-loans',
      icon: 'package-check',
      sortOrder: 9,
    },
    {
      code: 'logistics.settings',
      moduleId: logistics.id,
      nameKey: 'menus.logisticsSettings',
      path: '/logistics/settings',
      icon: 'settings',
      sortOrder: 10,
    },
    {
      code: 'logistics.ice-vouchers',
      moduleId: logistics.id,
      nameKey: 'menus.iceVouchers',
      path: '/logistics/ice-vouchers',
      icon: 'snowflake',
      sortOrder: 11,
    },
    {
      code: 'logistics.my-ice-vouchers',
      moduleId: logistics.id,
      nameKey: 'menus.myIceVouchers',
      path: '/logistics/my-ice-vouchers',
      icon: 'snowflake',
      sortOrder: 12,
    },
    {
      code: 'logistics.ice-voucher-report',
      moduleId: logistics.id,
      nameKey: 'menus.iceVoucherReport',
      path: '/logistics/ice-voucher-report',
      icon: 'chart-column',
      sortOrder: 13,
    },
    {
      code: 'evaluations.campaigns',
      moduleId: evaluations.id,
      nameKey: 'menus.evaluationCampaigns',
      path: '/evaluations/campaigns',
      icon: 'calendar-range',
      sortOrder: 1,
    },
    {
      code: 'evaluations.questions',
      moduleId: evaluations.id,
      nameKey: 'menus.evaluationQuestions',
      path: '/evaluations/questions',
      icon: 'message-square',
      sortOrder: 2,
    },
    {
      code: 'evaluations.list',
      moduleId: evaluations.id,
      nameKey: 'menus.evaluationsList',
      path: '/evaluations',
      icon: 'clipboard-list',
      sortOrder: 3,
    },
    {
      code: 'evaluations.submit',
      moduleId: evaluations.id,
      nameKey: 'menus.evaluationSubmit',
      path: '/evaluations/submit',
      icon: 'file-check',
      sortOrder: 4,
    },
    {
      code: 'evaluations.mine',
      moduleId: evaluations.id,
      nameKey: 'menus.myEvaluations',
      path: '/my-evaluations',
      icon: 'clipboard-list',
      sortOrder: 5,
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

  // مدیر منوهای «مال من» پرونده/کاروان/گروه/اسکان را ندارد (مخصوص زائر و نقش‌های مرتبط)
  const adminForbiddenMineMenus = menuRecords.filter(
    (item) =>
      item.code === 'reservations.mine' ||
      item.code === 'caravans.mine' ||
      item.code === 'groups.mine' ||
      item.code === 'evaluations.mine' ||
      item.code === 'accommodation.mine' ||
      item.code === 'location.mine' ||
      item.code === 'location.history',
  );
  if (adminForbiddenMineMenus.length) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: adminRole.id,
        menuId: { in: adminForbiddenMineMenus.map((item) => item.id) },
      },
    });
  }

  const managerMenuCodes = new Set([
    'dashboard.overview',
    'accommodation.mine',
    'accommodation.report',
    'logistics.my-vouchers',
    'logistics.my-loans',
    'logistics.my-ice-vouchers',
    'evaluations.mine',
  ]);
  const accommodationListMenu = menuRecords.find(
    (item) => item.code === 'accommodation.list',
  );
  if (accommodationListMenu) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: accommodationManagerRole.id,
        menuId: accommodationListMenu.id,
      },
    });
  }
  for (const menu of menuRecords.filter((item) =>
    managerMenuCodes.has(item.code),
  )) {
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

  const myAccommodationsMenuCodes = new Set(['accommodation.mine']);
  const rolesForMyAccommodations = [
    caravanManagerRole,
    groupManagerRole,
    pilgrimRole,
    licenseIssuerRole,
    headquartersRepresentativeRole,
  ];
  for (const role of rolesForMyAccommodations) {
    for (const menu of menuRecords.filter((item) =>
      myAccommodationsMenuCodes.has(item.code),
    )) {
      await prisma.roleMenu.upsert({
        where: {
          roleId_menuId: { roleId: role.id, menuId: menu.id },
        },
        update: {},
        create: { roleId: role.id, menuId: menu.id },
      });
    }
  }

  const caravanMenuCodes = new Set([
    'dashboard.overview',
    'caravans.mine',
    'groups.mine',
    'reservations.mine',
    'accommodation.mine',
    'evaluations.mine',
    'location.mine',
    'location.history',
  ]);
  const caravanListMenu = menuRecords.find(
    (item) => item.code === 'caravans.list',
  );
  if (caravanListMenu) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: caravanManagerRole.id,
        menuId: caravanListMenu.id,
      },
    });
  }
  for (const menu of menuRecords.filter((item) =>
    caravanMenuCodes.has(item.code),
  )) {
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

  const groupMenuCodes = new Set([
    'dashboard.overview',
    'groups.mine',
    'reservations.mine',
    'accommodation.mine',
  ]);
  for (const menu of menuRecords.filter((item) =>
    groupMenuCodes.has(item.code),
  )) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: groupManagerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: groupManagerRole.id, menuId: menu.id },
    });
  }

  const pilgrimMenuCodes = new Set([
    'dashboard.overview',
    'reservations.mine',
    'caravans.mine',
    'groups.mine',
    'accommodation.mine',
    'evaluations.mine',
    'location.mine',
    'location.history',
  ]);
  for (const menu of menuRecords.filter((item) =>
    pilgrimMenuCodes.has(item.code),
  )) {
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
  const pilgrimForbiddenMenus = menuRecords.filter(
    (item) => !pilgrimMenuCodes.has(item.code),
  );
  if (pilgrimForbiddenMenus.length) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: pilgrimRole.id,
        menuId: { in: pilgrimForbiddenMenus.map((item) => item.id) },
      },
    });
  }

  const licenseIssuerMenuCodes = new Set([
    'dashboard.overview',
    'licenses.issue',
    'licenses.issued',
  ]);
  for (const menu of menuRecords.filter((item) =>
    licenseIssuerMenuCodes.has(item.code),
  )) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: licenseIssuerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: licenseIssuerRole.id, menuId: menu.id },
    });
  }

  // صادرکننده مجوز فقط منوی مجوزها را دارد؛ اسکان را بردار
  const licenseIssuerForbiddenMenus = menuRecords.filter(
    (item) => !licenseIssuerMenuCodes.has(item.code),
  );
  if (licenseIssuerForbiddenMenus.length) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: licenseIssuerRole.id,
        menuId: { in: licenseIssuerForbiddenMenus.map((item) => item.id) },
      },
    });
  }

  const governmentOrgOfficerMenuCodes = new Set([
    'dashboard.overview',
    'caravans.support-requests',
    'caravans.support-request-report',
  ]);
  for (const menu of menuRecords.filter((item) =>
    governmentOrgOfficerMenuCodes.has(item.code),
  )) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: governmentOrgOfficerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: governmentOrgOfficerRole.id, menuId: menu.id },
    });
  }
  const governmentOrgOfficerForbiddenMenus = menuRecords.filter(
    (item) => !governmentOrgOfficerMenuCodes.has(item.code),
  );
  if (governmentOrgOfficerForbiddenMenus.length) {
    await prisma.roleMenu.deleteMany({
      where: {
        roleId: governmentOrgOfficerRole.id,
        menuId: { in: governmentOrgOfficerForbiddenMenus.map((item) => item.id) },
      },
    });
  }

  const unitManagerMenuCodes = new Set([
    'dashboard.overview',
    'headquarters.accommodation-liaisons',
    'headquarters.caravan-liaisons',
    'evaluations.mine',
  ]);
  for (const menu of menuRecords.filter((item) =>
    unitManagerMenuCodes.has(item.code),
  )) {
    await prisma.roleMenu.upsert({
      where: {
        roleId_menuId: {
          roleId: unitManagerRole.id,
          menuId: menu.id,
        },
      },
      update: {},
      create: { roleId: unitManagerRole.id, menuId: menu.id },
    });
  }

  await prisma.smsSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      endpoint: 'http://service.pejvaksoft.com',
      senderNumber: '10009155191225',
      username: 'pejvaksoft',
      password: 'P@dd45465',
    },
  });

  await prisma.iceVoucherSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      moldsPer50Pilgrims: 1,
      costPerMold: 0,
    },
  });

  await seedGeo();
  await seedPlaceTypes();

  const systemPasswordHash = await bcrypt.hash(
    `system-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    10,
  );
  await prisma.user.upsert({
    where: { username: '__system__' },
    update: {},
    create: {
      username: '__system__',
      passwordHash: systemPasswordHash,
      firstName: 'سیستم',
      lastName: 'سامانه',
      fullName: 'سیستم سامانه',
      locale: 'fa',
      status: 'ACTIVE',
    },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      firstName: 'مدیر',
      lastName: 'سامانه',
      fullName: 'مدیر سامانه',
      locale: 'fa',
      status: 'ACTIVE',
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
    join(__dirname, 'iran_provinces_and_cities_neshan.csv'),
  );
}

async function ensureIranCities(
  provinceId: string,
  rows: { nameFa: string; nameEn: string; code: string }[],
) {
  if (rows.length === 0) return;

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
  const toCreate: {
    provinceId: string;
    code: string;
    nameFa: string;
    nameEn: string;
    sortOrder: number;
    isActive: boolean;
  }[] = [];

  for (const row of rows) {
    const unmatched = existing.filter((city) => !matchedIds.has(city.id));
    const match =
      matchCity(unmatched, row) ?? matchCity(existing, row);

    if (match && !matchedIds.has(match.id)) {
      matchedIds.add(match.id);
      continue;
    }

    const code = uniqueCityCode(row.code, usedCodes);
    toCreate.push({
      provinceId,
      code,
      nameFa: row.nameFa,
      nameEn: row.nameEn,
      sortOrder: nextSortOrder,
      isActive: true,
    });
    existing.push({
      id: `pending-${code}`,
      code,
      nameFa: row.nameFa,
      sortOrder: nextSortOrder,
    });
    usedCodes.add(code);
    matchedIds.add(`pending-${code}`);
    nextSortOrder += 1;
  }

  if (toCreate.length > 0) {
    await prisma.city.createMany({ data: toCreate });
  }
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
  const officialIran = loadOfficialIranCities(
    join(__dirname, 'iran-official-cities.json'),
  );

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
        country.iso2 === 'IR'
          ? iranNeshan.provinces.get(province.nameFa)
          : undefined;
      if (country.iso2 === 'IR' && !location) {
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

      if (country.iso2 === 'IR') {
        const cityRows = iranNeshan.citiesByProvince.get(province.nameFa) ?? [];
        if (cityRows.length === 0) {
          throw new Error(
            `Neshan city rows missing for Iranian province: ${province.nameFa}`,
          );
        }
        await applyIranCityNeshan(provinceRecord.id, cityRows);

        const officialRows =
          officialIran.citiesByProvince[province.nameFa] ?? [];
        if (officialRows.length === 0) {
          throw new Error(
            `Official city rows missing for Iranian province: ${province.nameFa}`,
          );
        }
        await ensureIranCities(
          provinceRecord.id,
          officialRows.map((city) => ({
            code: `o${city.id}`,
            nameFa: city.nameFa,
            nameEn: city.nameFa,
          })),
        );
        await ensureIranCities(
          provinceRecord.id,
          extraIranCities
            .filter((city) => city.provinceFa === province.nameFa)
            .map((city) => ({
              code: city.code,
              nameFa: city.nameFa,
              nameEn: city.nameEn,
            })),
        );
      }
    }
  }

  const iranNames = new Set(
    geoSeed
      .find((country) => country.iso2 === 'IR')
      ?.provinces.map((province) => province.nameFa) ?? [],
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
  for (const nameFa of Object.keys(officialIran.citiesByProvince)) {
    if (!iranNames.has(nameFa)) {
      throw new Error(`Official city province not in geo seed: ${nameFa}`);
    }
  }
  for (const extra of extraIranCities) {
    if (!iranNames.has(extra.provinceFa)) {
      throw new Error(`Extra city province not in geo seed: ${extra.provinceFa}`);
    }
  }
}

const placeTypeSeed = [
  { code: 'hospital', nameFa: 'بیمارستان', nameEn: 'Hospital', icon: 'hospital', sortOrder: 1 },
  { code: 'pharmacy', nameFa: 'داروخانه', nameEn: 'Pharmacy', icon: 'pill', sortOrder: 2 },
  { code: 'mosque', nameFa: 'مسجد', nameEn: 'Mosque', icon: 'landmark', sortOrder: 3 },
  { code: 'gas-station', nameFa: 'پمپ بنزین', nameEn: 'Gas station', icon: 'fuel', sortOrder: 4 },
  { code: 'restaurant', nameFa: 'رستوران', nameEn: 'Restaurant', icon: 'utensils-crossed', sortOrder: 5 },
  { code: 'police', nameFa: 'پاسگاه پلیس', nameEn: 'Police station', icon: 'shield', sortOrder: 6 },
  { code: 'red-crescent', nameFa: 'هلال احمر', nameEn: 'Red Crescent', icon: 'heart-handshake', sortOrder: 7 },
];

async function seedPlaceTypes() {
  for (const item of placeTypeSeed) {
    await prisma.placeType.upsert({
      where: { code: item.code },
      update: {
        nameFa: item.nameFa,
        nameEn: item.nameEn,
        icon: item.icon,
        sortOrder: item.sortOrder,
      },
      create: item,
    });
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
