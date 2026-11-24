-- Copy latest-year accommodation contacts onto the standing contact list when empty.
INSERT INTO "accommodation_contacts" ("id", "accommodationId", "role", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, latest."accommodationId", latest."role", latest."userId", latest."createdAt", latest."updatedAt"
FROM (
  SELECT DISTINCT ON ("accommodationId", "role")
    "accommodationId",
    "role",
    "userId",
    "createdAt",
    "updatedAt"
  FROM "accommodation_year_contacts"
  ORDER BY "accommodationId", "role", "year" DESC
) AS latest
WHERE NOT EXISTS (
  SELECT 1
  FROM "accommodation_contacts" AS standing
  WHERE standing."accommodationId" = latest."accommodationId"
    AND standing."role" = latest."role"
);

DROP TABLE IF EXISTS "accommodation_year_contacts";

-- Keep the newest manager row per (user, accommodation); drop year placeholders.
DELETE FROM "accommodation_managers" AS m
WHERE m."userId" IS NULL
   OR EXISTS (
     SELECT 1
     FROM "accommodation_managers" AS other
     WHERE other."userId" = m."userId"
       AND other."accommodationId" = m."accommodationId"
       AND (
         other."year" > m."year"
         OR (other."year" = m."year" AND other."createdAt" > m."createdAt")
         OR (other."year" = m."year" AND other."createdAt" = m."createdAt" AND other."id" > m."id")
       )
   );

DROP INDEX IF EXISTS "accommodation_managers_userId_accommodationId_year_key";
DROP INDEX IF EXISTS "accommodation_managers_user_year_primary_key";
DROP INDEX IF EXISTS "accommodation_managers_unassigned_year_key";
DROP INDEX IF EXISTS "accommodation_managers_accommodationId_year_idx";
DROP INDEX IF EXISTS "accommodation_managers_year_idx";

ALTER TABLE "accommodation_managers" DROP COLUMN "year";
ALTER TABLE "accommodation_managers" DROP COLUMN "maleCapacity";
ALTER TABLE "accommodation_managers" DROP COLUMN "femaleCapacity";
ALTER TABLE "accommodation_managers" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "accommodation_managers_userId_accommodationId_key"
  ON "accommodation_managers"("userId", "accommodationId");

DROP TABLE IF EXISTS "caravan_contacts";
DROP TABLE IF EXISTS "caravan_years";

ALTER TABLE "caravans" DROP CONSTRAINT IF EXISTS "caravans_walkingRouteId_fkey";
DROP INDEX IF EXISTS "caravans_walkingRouteId_idx";
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "walkingRouteId";
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "totalCount";
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "maleCount";
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "femaleCount";

ALTER TABLE "reception_settings" DROP COLUMN IF EXISTS "caravanMaxPerNationalId";

DELETE FROM "role_menus"
WHERE "menuId" IN (
  SELECT "id" FROM "menus"
  WHERE "code" IN ('caravans.year-management', 'accommodation.year-management')
);

DELETE FROM "menus"
WHERE "code" IN ('caravans.year-management', 'accommodation.year-management');
