export const sortDirections = ['asc', 'desc'] as const;
export type SortDirection = (typeof sortDirections)[number];

/**
 * Build Prisma orderBy: primary sort (if valid) then stable fallbacks.
 * Pass an explicit type argument, e.g.
 * resolveSortOrder<Prisma.UserOrderByWithRelationInput>(...)
 */
export function resolveSortOrder<TOrderBy>(
  sortBy: string | undefined,
  sortDir: SortDirection | undefined,
  builders: Record<string, (dir: SortDirection) => TOrderBy>,
  fallback: NoInfer<TOrderBy>[],
): TOrderBy[] {
  if (!sortBy || (sortDir !== 'asc' && sortDir !== 'desc')) {
    return fallback;
  }
  const build = builders[sortBy];
  if (!build) {
    return fallback;
  }
  return [build(sortDir), ...fallback];
}
