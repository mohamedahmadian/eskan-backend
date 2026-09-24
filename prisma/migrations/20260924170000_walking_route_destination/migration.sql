-- CreateEnum
CREATE TYPE "WalkingRouteStageKind" AS ENUM ('STATION', 'DESTINATION');

-- AlterTable
ALTER TABLE "walking_route_stages" ADD COLUMN "kind" "WalkingRouteStageKind" NOT NULL DEFAULT 'STATION';

-- ایستگاه شهر مشهد روی مسیر معتبر نیست؛ مقصد جداگانه جایگزین آن می‌شود.
DELETE FROM "walking_route_stages" AS stage
USING "walking_stations" AS station, "cities" AS city
WHERE stage."walkingStationId" = station.id
  AND station."cityId" = city.id
  AND city."nameFa" = 'مشهد';

-- شماره‌گذاری دوباره تا بعد از حذف ایستگاه مشهد فاصله نماند.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "walkingRouteId" ORDER BY "stageNumber") AS next_number
  FROM "walking_route_stages"
)
UPDATE "walking_route_stages" AS stage
SET "stageNumber" = -ranked.next_number
FROM ranked
WHERE stage.id = ranked.id;

UPDATE "walking_route_stages"
SET "stageNumber" = -"stageNumber"
WHERE "stageNumber" < 0;

ALTER TABLE "walking_route_stages" ALTER COLUMN "walkingStationId" DROP NOT NULL;

INSERT INTO "walking_route_stages" (
  "id",
  "walkingRouteId",
  "walkingStationId",
  "stageNumber",
  "kind",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  route.id,
  NULL,
  COALESCE((
    SELECT MAX(stage."stageNumber")
    FROM "walking_route_stages" AS stage
    WHERE stage."walkingRouteId" = route.id
  ), 0) + 1,
  'DESTINATION',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "walking_routes" AS route
WHERE NOT EXISTS (
  SELECT 1
  FROM "walking_route_stages" AS stage
  WHERE stage."walkingRouteId" = route.id
    AND stage.kind = 'DESTINATION'
);

ALTER TABLE "walking_route_stages" ADD CONSTRAINT "walking_route_stages_kind_check" CHECK (
  ("kind" = 'STATION' AND "walkingStationId" IS NOT NULL)
  OR ("kind" = 'DESTINATION' AND "walkingStationId" IS NULL)
);

CREATE UNIQUE INDEX "walking_route_stages_one_destination_idx"
  ON "walking_route_stages" ("walkingRouteId")
  WHERE "kind" = 'DESTINATION';
