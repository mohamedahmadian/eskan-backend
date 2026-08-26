export type RoleRef = { code: string; nameKey?: string };

export type RoleBearer = {
  userRoles?: { role: RoleRef }[];
  roles?: RoleRef[];
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

export function isLicenseIssuer(user: RoleBearer | null | undefined) {
  return hasRole(user, 'LICENSE_ISSUER');
}

export function isUnitManager(user: RoleBearer | null | undefined) {
  return hasRole(user, 'UNIT_MANAGER');
}

export function isGovernmentOrgOfficer(user: RoleBearer | null | undefined) {
  return hasRole(user, 'GOVERNMENT_ORG_OFFICER');
}

export function canAccessMyCaravans(user: RoleBearer | null | undefined) {
  return isAdmin(user) || isCaravanManager(user);
}

export function canAccessMyReservations(user: RoleBearer | null | undefined) {
  return (
    !isAdmin(user) &&
    (isPilgrim(user) || isCaravanManager(user) || isGroupManager(user))
  );
}

export function canAccessMyGroups(user: RoleBearer | null | undefined) {
  return (
    isAdmin(user) ||
    isGroupManager(user) ||
    isCaravanManager(user) ||
    isPilgrim(user)
  );
}

export function canAccessMyAccommodations(user: RoleBearer | null | undefined) {
  return Boolean(user) && !isAdmin(user);
}
