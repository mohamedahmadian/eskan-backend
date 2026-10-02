import { IMAM_REZA_SHRINE } from '../common/shrine';

export type SolverGender = 'men' | 'women';

export type SolverAssignment = {
  groupId: string;
  gender: SolverGender;
  placeId: string;
};

export type SolverGroupInput = {
  id: string;
  men: number;
  women: number;
  origin_city: string;
  origin_city_distance: number;
};

export type SolverPlaceInput = {
  id: string;
  type: SolverGender;
  capacity: number;
  lat: number;
  lng: number;
  event_distance: number;
};

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** فاصله تا حرم به متر. مقدار ذخیره‌شده کیلومتر است؛ اگر نباشد از مختصات حساب می‌شود. */
export function eventDistanceMeters(
  latitude: number,
  longitude: number,
  storedKm: number | null,
) {
  if (storedKm != null && storedKm > 0) return Math.max(1, Math.round(storedKm * 1000));
  return Math.max(
    1,
    Math.round(
      haversineMeters(
        latitude,
        longitude,
        IMAM_REZA_SHRINE.latitude,
        IMAM_REZA_SHRINE.longitude,
      ),
    ),
  );
}

/** فاصله شهر مبدأ تا حرم به کیلومتر. صفر حل‌کننده را خراب می‌کند، پس حداقل ۱ است. */
export function originDistanceKm(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return 1;
  return Math.max(
    1,
    Math.round(
      haversineMeters(
        latitude,
        longitude,
        IMAM_REZA_SHRINE.latitude,
        IMAM_REZA_SHRINE.longitude,
      ) / 1000,
    ),
  );
}

export function buildSolverDocument(input: {
  groups: SolverGroupInput[];
  places: SolverPlaceInput[];
  timeLimitSeconds: number;
  checkpointPath: string;
}) {
  return {
    groups: input.groups,
    places: input.places,
    city_conflicts: [] as [string, string][],
    options: {
      time_limit_seconds: input.timeLimitSeconds,
      checkpoint_path: input.checkpointPath,
    },
  };
}

export function parseCheckpointAssignments(raw: Record<string, unknown>): SolverAssignment[] {
  const rows: SolverAssignment[] = [];
  for (const [key, placeId] of Object.entries(raw)) {
    if (typeof placeId !== 'string' || !placeId) continue;
    const split = key.lastIndexOf(':');
    if (split <= 0) continue;
    const gender = key.slice(split + 1);
    if (gender !== 'men' && gender !== 'women') continue;
    rows.push({ groupId: key.slice(0, split), gender, placeId });
  }
  return rows;
}

export function parseFinalAssignments(raw: unknown): SolverAssignment[] {
  if (!Array.isArray(raw)) return [];
  const rows: SolverAssignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (row.gender !== 'men' && row.gender !== 'women') continue;
    if (typeof row.group_id !== 'string' || typeof row.place_id !== 'string') continue;
    rows.push({ groupId: row.group_id, gender: row.gender, placeId: row.place_id });
  }
  return rows;
}
