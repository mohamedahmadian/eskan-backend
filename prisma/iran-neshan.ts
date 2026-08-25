import { readFileSync } from "node:fs";

export type NeshanLocation = {
  neshanAddress: string;
  latitude: number;
  longitude: number;
};

export type IranCityNeshan = NeshanLocation & {
  nameFa: string;
  slug: string;
  isProvinceCapital: boolean;
};

export type IranNeshanData = {
  provinces: Map<string, NeshanLocation>;
  citiesByProvince: Map<string, IranCityNeshan[]>;
};

export function loadIranProvincesAndCitiesNeshan(csvPath: string): IranNeshanData {
  const csv = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const provinces = new Map<string, NeshanLocation>();
  const citiesByProvince = new Map<string, IranCityNeshan[]>();

  for (const rawLine of csv.split(/\r?\n/).slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;

    const [
      provinceNameFa,
      cityNameFa,
      neshanAddress,
      latitudeRaw,
      longitudeRaw,
      slug,
      capitalFlag,
    ] = line.split(",");
    const latitude = Number(latitudeRaw);
    const longitude = Number(longitudeRaw);
    if (
      !provinceNameFa ||
      !cityNameFa ||
      !neshanAddress ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      throw new Error(`Invalid Neshan location row: ${line}`);
    }

    const location: NeshanLocation = {
      neshanAddress: neshanAddress.trim(),
      latitude,
      longitude,
    };
    const province = provinceNameFa.trim();
    const capital = (capitalFlag ?? "").trim();

    if (capital.includes("استان") || cityNameFa.startsWith("مرکزیت")) {
      provinces.set(province, location);
      continue;
    }

    const cities = citiesByProvince.get(province) ?? [];
    cities.push({
      ...location,
      nameFa: cityNameFa.trim(),
      slug: (slug ?? "").trim(),
      isProvinceCapital: capital === "بله",
    });
    citiesByProvince.set(province, cities);
  }

  return { provinces, citiesByProvince };
}

export function normalizeFaName(value: string) {
  return value
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s\-_]/g, "")
    .trim();
}

export function codeFromNeshanSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/-city$/, "")
    .replace(/-island$/, "");
}

export function nameEnFromNeshanSlug(slug: string) {
  return codeFromNeshanSlug(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function displayCityNameFa(nameFa: string) {
  return nameFa.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

export function matchCity<T extends { nameFa: string; code: string }>(
  cities: T[],
  row: { nameFa: string; slug?: string; code?: string },
): T | undefined {
  const target = normalizeFaName(row.nameFa);
  const exact = cities.find((city) => city.nameFa === row.nameFa);
  if (exact) return exact;

  const byNorm = cities.find((city) => normalizeFaName(city.nameFa) === target);
  if (byNorm) return byNorm;

  const strippedTarget = target.replace(/^بندر/, "");
  const byBandar = cities.find((city) => {
    const normalized = normalizeFaName(city.nameFa).replace(/^بندر/, "");
    return normalized === strippedTarget && normalized.length > 0;
  });
  if (byBandar) return byBandar;

  const code = codeFromNeshanSlug(row.slug ?? row.code ?? "");
  const compactCode = code.replace(/-/g, "");
  if (!code) return undefined;
  return cities.find(
    (city) =>
      city.code === code || city.code.replace(/-/g, "") === compactCode,
  );
}

export function uniqueCityCode(base: string, used: Set<string>) {
  const fallback = base || "city";
  if (!used.has(fallback)) {
    return fallback;
  }
  let index = 2;
  while (used.has(`${fallback}-${index}`)) {
    index += 1;
  }
  return `${fallback}-${index}`;
}
