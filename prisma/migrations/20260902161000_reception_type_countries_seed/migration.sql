-- Existing years: individual and group stay Iran-only (previous hard rule).
INSERT INTO "reception_settings_countries" ("year", "countryId", "feature")
SELECT s."year", c."id", f.feature
FROM "reception_settings" s
CROSS JOIN "countries" c
CROSS JOIN (
    SELECT 'INDIVIDUAL'::"ReceptionFeature" AS feature
    UNION ALL SELECT 'GROUP'::"ReceptionFeature"
) f
WHERE c."iso2" = 'IR'
ON CONFLICT DO NOTHING;

-- Caravan remains available for every active country.
INSERT INTO "reception_settings_countries" ("year", "countryId", "feature")
SELECT s."year", c."id", 'CARAVAN'::"ReceptionFeature"
FROM "reception_settings" s
CROSS JOIN "countries" c
WHERE c."isActive" = true
ON CONFLICT DO NOTHING;
