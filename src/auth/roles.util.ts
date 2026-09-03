export type RoleRef = { code: string; nameKey?: string };

export type RoleBearer = {
  userRoles?: { role: RoleRef }[];
  roles?: RoleRef[];
  hasGroup?: boolean;
  managesAccommodation?: boolean;
};

export function roleCodes(user: RoleBearer | null | undefined): string[] {
  if (!user) {
    return [];
  }
  if (user.userRoles?.length) {
    return user.userRoles.map((item) => item.role.code);
  }
  return user.roles?.map((role) => role.code) ?? [];
}

export function hasRole(user: RoleBearer | null | undefined, code: string) {
  return roleCodes(user).includes(code);
}

/** Logged-in account with no domain/system roles yet. */
export function hasNoRoles(user: RoleBearer | null | undefined) {
  return Boolean(user) && roleCodes(user).length === 0;
}

export function isAdmin(user: RoleBearer | null | undefined) {
  return hasRole(user, 'ADMIN');
}

export function isPilgrim(user: RoleBearer | null | undefined) {
  return hasRole(user, 'PILGRIM');
}

export function isCaravanManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'CARAVAN_MANAGER');
}

export function isGroupManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'GROUP_MANAGER');
}

export function isAccommodationManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'ACCOMMODATION_MANAGER');
}

/** زائر فقط با گروه یا مدیریت اسکان منوهای گروه/اسکان/ارزیابی را می‌بیند */
export function pilgrimHasGroupOrHousingAccess(
  user: RoleBearer | null | undefined,
) {
  return (
    isGroupManager(user) ||
    isAccommodationManager(user) ||
    Boolean(user?.hasGroup) ||
    Boolean(user?.managesAccommodation)
  );
}

export function isLicenseIssuer(user: RoleBearer | null | undefined) {
  return hasRole(user, 'LICENSE_ISSUER');
}

export function isUnitManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'UNIT_MANAGER');
}

export function isGovernmentOrgOfficer(user: RoleBearer | null | undefined) {
  return hasRole(user, 'GOVERNMENT_ORG_OFFICER');
}

export function isHonoraryServant(user: RoleBearer | null | undefined) {
  return hasRole(user, 'HONORARY_SERVANT');
}

export function isStationManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'STATION_MANAGER');
}

export function canAccessMyCaravans(user: RoleBearer | null | undefined) {
  return isAdmin(user) || isCaravanManager(user);
}

export function canAccessMyReservations(user: RoleBearer | null | undefined) {
  if (!user || isAdmin(user)) {
    return false;
  }
  if (hasNoRoles(user)) {
    return true;
  }
  return isPilgrim(user) || isCaravanManager(user) || isGroupManager(user);
}

export function canAccessMyGroups(user: RoleBearer | null | undefined) {
  if (isAdmin(user) || isGroupManager(user) || isCaravanManager(user)) {
    return true;
  }
  return isPilgrim(user) && pilgrimHasGroupOrHousingAccess(user);
}

export function canAccessMyAccommodations(user: RoleBearer | null | undefined) {
  if (!user || isAdmin(user)) {
    return false;
  }
  if (isPilgrim(user) && !isCaravanManager(user) && !pilgrimHasGroupOrHousingAccess(user)) {
    return false;
  }
  return true;
}

export function canAccessMyEvaluations(user: RoleBearer | null | undefined) {
  if (!user || isAdmin(user)) {
    return false;
  }
  if (isPilgrim(user) && !isCaravanManager(user) && !pilgrimHasGroupOrHousingAccess(user)) {
    return false;
  }
  return true;
}
