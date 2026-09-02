-- Existing years: caravan-officials step stays Iran-only (same as companions/insurance).
INSERT INTO "reception_settings_countries" ("year", "countryId", "feature")
SELECT s."year", c."id", 'CARAVAN_CONTACTS'::"ReceptionFeature"
FROM "reception_settings" s
CROSS JOIN "countries" c
WHERE c."iso2" = 'IR'
ON CONFLICT DO NOTHING;
