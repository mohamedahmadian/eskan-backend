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

export function canAccessMyCaravans(user: RoleBearer | null | undefined) {
  return isAdmin(user) || isCaravanManager(user);
}
