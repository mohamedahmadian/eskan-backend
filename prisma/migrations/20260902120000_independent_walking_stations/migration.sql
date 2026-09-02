-- CreateTable
CREATE TABLE "walking_stations" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "managerName" TEXT,
    "managerPhone" TEXT,
    "managerTelegram" TEXT,
    "managerWhatsapp" TEXT,
    "managerEitaa" TEXT,
    "distanceToMashhadKm" DECIMAL(8,2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceKey" TEXT,

    CONSTRAINT "walking_stations_pkey" PRIMARY KEY ("id")
);

-- Named stations: one record per city + normalized name
INSERT INTO "walking_stations" (
    "id",
    "cityId",
    "name",
    "latitude",
    "longitude",
    "managerName",
    "managerPhone",
    "managerTelegram",
    "managerWhatsapp",
    "managerEitaa",
    "distanceToMashhadKm",
    "description",
    "createdAt",
    "updatedAt",
    "sourceKey"
)
SELECT
    gen_random_uuid()::text,
    s."cityId",
    trim(s."name"),
    s."latitude",
    s."longitude",
    s."managerName",
    s."managerPhone",
    s."managerTelegram",
    s."managerWhatsapp",
    s."managerEitaa",
    s."distanceToMashhadKm",
    s."description",
    s."createdAt",
    s."updatedAt",
    s."cityId" || ':' || lower(trim(s."name"))
FROM (
    SELECT DISTINCT ON ("cityId", lower(trim("name")))
        *
    FROM "walking_route_stages"
    WHERE "name" IS NOT NULL AND btrim("name") <> ''
    ORDER BY "cityId", lower(trim("name")), "createdAt" ASC
) s;

-- Unnamed stages become their own stations
INSERT INTO "walking_stations" (
    "id",
    "cityId",
    "name",
    "latitude",
    "longitude",
    "managerName",
    "managerPhone",
    "managerTelegram",
    "managerWhatsapp",
    "managerEitaa",
    "distanceToMashhadKm",
    "description",
    "createdAt",
    "updatedAt",
    "sourceKey"
)
SELECT
    gen_random_uuid()::text,
    s."cityId",
    'ایستگاه',
    s."latitude",
    s."longitude",
    s."managerName",
    s."managerPhone",
    s."managerTelegram",
    s."managerWhatsapp",
    s."managerEitaa",
    s."distanceToMashhadKm",
    s."description",
    s."createdAt",
    s."updatedAt",
    'stage:' || s."id"
FROM "walking_route_stages" s
WHERE s."name" IS NULL OR btrim(s."name") = '';

-- AlterTable
ALTER TABLE "walking_route_stages" ADD COLUMN "walkingStationId" TEXT;

UPDATE "walking_route_stages" s
SET "walkingStationId" = st."id"
FROM "walking_stations" st
WHERE s."name" IS NOT NULL
  AND btrim(s."name") <> ''
  AND st."sourceKey" = s."cityId" || ':' || lower(trim(s."name"));

UPDATE "walking_route_stages" s
SET "walkingStationId" = st."id"
FROM "walking_stations" st
WHERE (s."name" IS NULL OR btrim(s."name") = '')
  AND st."sourceKey" = 'stage:' || s."id";

-- Safety: any leftover stage without a station
INSERT INTO "walking_stations" (
    "id",
    "cityId",
    "name",
    "latitude",
    "longitude",
    "managerName",
    "managerPhone",
    "managerTelegram",
    "managerWhatsapp",
    "managerEitaa",
    "distanceToMashhadKm",
    "description",
    "createdAt",
    "updatedAt",
    "sourceKey"
)
SELECT
    gen_random_uuid()::text,
    s."cityId",
    COALESCE(NULLIF(btrim(s."name"), ''), 'ایستگاه'),
    s."latitude",
    s."longitude",
    s."managerName",
    s."managerPhone",
    s."managerTelegram",
    s."managerWhatsapp",
    s."managerEitaa",
    s."distanceToMashhadKm",
    s."description",
    s."createdAt",
    s."updatedAt",
    'leftover:' || s."id"
FROM "walking_route_stages" s
WHERE s."walkingStationId" IS NULL;

UPDATE "walking_route_stages" s
SET "walkingStationId" = st."id"
FROM "walking_stations" st
WHERE s."walkingStationId" IS NULL
  AND st."sourceKey" = 'leftover:' || s."id";

ALTER TABLE "walking_route_stages" ALTER COLUMN "walkingStationId" SET NOT NULL;

ALTER TABLE "reservation_travel_histories" ADD COLUMN "walkingStationId" TEXT;

UPDATE "reservation_travel_histories" h
SET "walkingStationId" = s."walkingStationId"
FROM "walking_route_stages" s
WHERE h."walkingRouteStageId" = s."id";

ALTER TABLE "reservation_travel_histories" DROP CONSTRAINT "reservation_travel_histories_walkingRouteStageId_fkey";
DROP INDEX "reservation_travel_histories_walkingRouteStageId_idx";
ALTER TABLE "reservation_travel_histories" DROP COLUMN "walkingRouteStageId";

ALTER TABLE "walking_route_stages" DROP CONSTRAINT "walking_route_stages_cityId_fkey";
DROP INDEX "walking_route_stages_cityId_idx";
ALTER TABLE "walking_route_stages" DROP COLUMN "cityId";
ALTER TABLE "walking_route_stages" DROP COLUMN "name";
ALTER TABLE "walking_route_stages" DROP COLUMN "latitude";
ALTER TABLE "walking_route_stages" DROP COLUMN "longitude";
ALTER TABLE "walking_route_stages" DROP COLUMN "managerName";
ALTER TABLE "walking_route_stages" DROP COLUMN "managerPhone";
ALTER TABLE "walking_route_stages" DROP COLUMN "managerTelegram";
ALTER TABLE "walking_route_stages" DROP COLUMN "managerWhatsapp";
ALTER TABLE "walking_route_stages" DROP COLUMN "managerEitaa";
ALTER TABLE "walking_route_stages" DROP COLUMN "distanceToMashhadKm";
ALTER TABLE "walking_route_stages" DROP COLUMN "description";

ALTER TABLE "walking_stations" DROP COLUMN "sourceKey";

DELETE FROM "walking_route_stages" a
USING "walking_route_stages" b
WHERE a."walkingRouteId" = b."walkingRouteId"
  AND a."walkingStationId" = b."walkingStationId"
  AND a."id" <> b."id"
  AND a."stageNumber" > b."stageNumber";

CREATE INDEX "walking_stations_cityId_idx" ON "walking_stations"("cityId");
CREATE INDEX "walking_stations_name_idx" ON "walking_stations"("name");
CREATE INDEX "walking_route_stages_walkingStationId_idx" ON "walking_route_stages"("walkingStationId");
CREATE UNIQUE INDEX "walking_route_stages_walkingRouteId_walkingStationId_key" ON "walking_route_stages"("walkingRouteId", "walkingStationId");
CREATE INDEX "reservation_travel_histories_walkingStationId_idx" ON "reservation_travel_histories"("walkingStationId");

ALTER TABLE "walking_stations" ADD CONSTRAINT "walking_stations_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "walking_route_stages" ADD CONSTRAINT "walking_route_stages_walkingStationId_fkey" FOREIGN KEY ("walkingStationId") REFERENCES "walking_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_walkingStationId_fkey" FOREIGN KEY ("walkingStationId") REFERENCES "walking_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Independent stations menu under base-info
UPDATE "menus"
SET "sortOrder" = 6
WHERE "code" = 'base-info.walking-routes';

INSERT INTO "menus" ("id", "moduleId", "code", "nameKey", "path", "icon", "sortOrder")
SELECT gen_random_uuid()::text, m."id", 'base-info.walking-stations', 'menus.walkingStations', '/base-info/walking-stations', 'milestone', 5
FROM "nav_modules" m
WHERE m."code" = 'base-info'
  AND NOT EXISTS (SELECT 1 FROM "menus" WHERE "code" = 'base-info.walking-stations');

INSERT INTO "role_menus" ("roleId", "menuId")
SELECT r."id", m."id"
FROM "roles" r
CROSS JOIN "menus" m
WHERE r."code" = 'ADMIN'
  AND m."code" = 'base-info.walking-stations'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menus" rm
    WHERE rm."roleId" = r."id" AND rm."menuId" = m."id"
  );
