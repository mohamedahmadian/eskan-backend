export const ADMIN_FORBIDDEN_MINE_MENU_CODES = [
  'reservations.create',
  'reservations.mine',
  'groups.mine',
  'evaluations.mine',
  'accommodation.mine',
  'accommodation.introduce',
  'accommodation.introduced',
  'stations.mine',
  'stations.report',
  'stations.history',
  'location.mine',
  'location.history',
] as const;

const honoraryAndHome = [
  'dashboard.overview',
  'honorary-service.apply',
  'honorary-service.history',
  'participations.home',
  'participations.in-kind',
] as const;

const introduceMenuCodes = [
  'accommodation.introduce',
  'accommodation.introduced',
] as const;

const sharedCaravanMenuCodes = [
  'caravans.register',
  'caravans.mine',
] as const;

export const DEFAULT_MENU_CODES_BY_ROLE: Record<string, readonly string[]> = {
  ACCOMMODATION_MANAGER: [
    ...honoraryAndHome,
    'accommodation.list',
    'accommodation.mine',
    'accommodation.report',
    'logistics.my-vouchers',
    'logistics.my-loans',
    'logistics.my-ice-vouchers',
    'evaluations.mine',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  CARAVAN_MANAGER: [
    ...honoraryAndHome,
    'groups.mine',
    'reservations.create',
    'reservations.mine',
    'accommodation.mine',
    'evaluations.mine',
    'location.mine',
    'location.history',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  GROUP_MANAGER: [
    ...honoraryAndHome,
    'groups.mine',
    'reservations.create',
    'reservations.mine',
    'accommodation.mine',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  PILGRIM: [
    ...honoraryAndHome,
    'reservations.create',
    'reservations.mine',
    'groups.mine',
    'accommodation.mine',
    'evaluations.mine',
    'location.mine',
    'location.history',
    'participations.campaigns',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  HONORARY_SERVANT: [
    ...honoraryAndHome,
    'reservations.translator',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  LICENSE_ISSUER: [
    ...honoraryAndHome,
    'licenses.issue',
    'licenses.issued',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  GOVERNMENT_ORG_OFFICER: [
    ...honoraryAndHome,
    'caravans.support-requests',
    'caravans.support-request-report',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  STATION_MANAGER: [
    ...honoraryAndHome,
    'stations.mine',
    'stations.report',
    'stations.history',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  UNIT_MANAGER: [
    ...honoraryAndHome,
    'headquarters.accommodation-liaisons',
    'headquarters.caravan-liaisons',
    'evaluations.mine',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
  HEADQUARTERS_REPRESENTATIVE: [
    'accommodation.mine',
    'honorary-service.apply',
    'honorary-service.history',
    'participations.home',
    'participations.in-kind',
    ...introduceMenuCodes,
    ...sharedCaravanMenuCodes,
  ],
};

export function adminMenuCodes(allMenuCodes: string[]) {
  const forbidden = new Set<string>(ADMIN_FORBIDDEN_MINE_MENU_CODES);
  return allMenuCodes.filter((code) => !forbidden.has(code));
}
