import { readFileSync } from "node:fs";

export type OfficialCityRow = {
  id: string;
  nameFa: string;
};

export type OfficialCitiesData = {
  source: string;
  citiesByProvince: Record<string, OfficialCityRow[]>;
};

export type ExtraIranCity = {
  provinceFa: string;
  nameFa: string;
  nameEn: string;
  code: string;
};

export const extraIranCities: ExtraIranCity[] = [
  {
    provinceFa: "خراسان رضوی",
    nameFa: "زاوه",
    nameEn: "Zaveh",
    code: "zaveh",
  },
  {
    provinceFa: "خراسان رضوی",
    nameFa: "منطقه 1",
    nameEn: "Mashhad District 1",
    code: "mashhad-district-1",
  },
  {
    provinceFa: "خراسان رضوی",
    nameFa: "منطقه 8 (ثامن)",
    nameEn: "Mashhad Samen District",
    code: "mashhad-samen-district",
  },
  {
    provinceFa: "خراسان شمالی",
    nameFa: "مانه و سملقان",
    nameEn: "Maneh and Samalqan",
    code: "maneh-samalqan",
  },
];

export function loadOfficialIranCities(jsonPath: string): OfficialCitiesData {
  return JSON.parse(readFileSync(jsonPath, "utf8")) as OfficialCitiesData;
}
