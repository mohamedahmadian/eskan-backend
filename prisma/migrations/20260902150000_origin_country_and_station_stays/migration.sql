CREATE TYPE "ReceptionFeature" AS ENUM ('MASHHAD_PLACEMENT', 'ROUTE_PLACEMENT', 'COMPANIONS', 'INSURANCE');

CREATE TYPE "ReservationStationStayStatus" AS ENUM ('RESERVED', 'CANCELLED', 'EVACUATED');

ALTER TABLE "reservations" ADD COLUMN "originCountryId" TEXT;

CREATE TABLE "reception_settings_countries" (
    "year" INTEGER NOT NULL,
    "countryId" TEXT NOT NULL,
    "feature" "ReceptionFeature" NOT NULL,

    CONSTRAINT "reception_settings_countries_pkey" PRIMARY KEY ("year","countryId","feature")
);

CREATE TABLE "reservation_station_stays" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "walkingStationId" TEXT NOT NULL,
    "stayDate" DATE NOT NULL,
    "maleCount" INTEGER NOT NULL,
    "femaleCount" INTEGER NOT NULL,
    "status" "ReservationStationStayStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "evacuatedAt" TIMESTAMP(3),
    "evacuatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_station_stays_pkey" PRIMARY KEY ("id")
);

-- Caravan city country
UPDATE "reservations" r
SET "originCountryId" = p."countryId"
FROM "caravans" cv
JOIN "cities" ci ON ci."id" = cv."cityId"
JOIN "provinces" p ON p."id" = ci."provinceId"
WHERE r."caravanId" = cv."id"
  AND r."originCountryId" IS NULL;

-- Group city country
UPDATE "reservations" r
SET "originCountryId" = p."countryId"
FROM "groups" g
JOIN "cities" ci ON ci."id" = g."cityId"
JOIN "provinces" p ON p."id" = ci."provinceId"
WHERE r."groupId" = g."id"
  AND r."originCountryId" IS NULL;

-- Walking route with a single origin country
UPDATE "reservations" r
SET "originCountryId" = oc."countryId"
FROM (
    SELECT "walkingRouteId", MIN("countryId") AS "countryId"
    FROM "walking_route_origin_countries"
    GROUP BY "walkingRouteId"
    HAVING COUNT(*) = 1
) oc
WHERE r."walkingRouteId" = oc."walkingRouteId"
  AND r."originCountryId" IS NULL;

-- Remaining: first origin country of the selected route
UPDATE "reservations" r
SET "originCountryId" = picked."countryId"
FROM (
    SELECT DISTINCT ON (oc."walkingRouteId")
        oc."walkingRouteId",
        oc."countryId"
    FROM "walking_route_origin_countries" oc
    JOIN "countries" c ON c."id" = oc."countryId"
    ORDER BY oc."walkingRouteId", c."sortOrder" ASC, c."nameFa" ASC
) picked
WHERE r."walkingRouteId" = picked."walkingRouteId"
  AND r."originCountryId" IS NULL;

INSERT INTO "reception_settings_countries" ("year", "countryId", "feature")
SELECT s."year", c."id", f.feature
FROM "reception_settings" s
CROSS JOIN "countries" c
CROSS JOIN (
    SELECT 'MASHHAD_PLACEMENT'::"ReceptionFeature" AS feature
    UNION ALL SELECT 'COMPANIONS'::"ReceptionFeature"
    UNION ALL SELECT 'INSURANCE'::"ReceptionFeature"
) f
WHERE c."iso2" = 'IR'
ON CONFLICT DO NOTHING;

INSERT INTO "reception_settings_countries" ("year", "countryId", "feature")
SELECT s."year", c."id", 'ROUTE_PLACEMENT'::"ReceptionFeature"
FROM "reception_settings" s
CROSS JOIN "countries" c
WHERE c."isActive" = true
ON CONFLICT DO NOTHING;

CREATE INDEX "reservations_originCountryId_idx" ON "reservations"("originCountryId");
CREATE INDEX "reception_settings_countries_countryId_idx" ON "reception_settings_countries"("countryId");
CREATE INDEX "reception_settings_countries_feature_idx" ON "reception_settings_countries"("feature");
CREATE INDEX "reservation_station_stays_reservationId_status_idx" ON "reservation_station_stays"("reservationId", "status");
CREATE INDEX "reservation_station_stays_walkingStationId_status_idx" ON "reservation_station_stays"("walkingStationId", "status");
CREATE INDEX "reservation_station_stays_walkingStationId_stayDate_idx" ON "reservation_station_stays"("walkingStationId", "stayDate");
CREATE UNIQUE INDEX "reservation_station_stays_active_key" ON "reservation_station_stays"("reservationId", "walkingStationId") WHERE "status" = 'RESERVED';

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reception_settings_countries" ADD CONSTRAINT "reception_settings_countries_year_fkey" FOREIGN KEY ("year") REFERENCES "reception_settings"("year") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reception_settings_countries" ADD CONSTRAINT "reception_settings_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_station_stays" ADD CONSTRAINT "reservation_station_stays_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_station_stays" ADD CONSTRAINT "reservation_station_stays_walkingStationId_fkey" FOREIGN KEY ("walkingStationId") REFERENCES "walking_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_station_stays" ADD CONSTRAINT "reservation_station_stays_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_station_stays" ADD CONSTRAINT "reservation_station_stays_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_station_stays" ADD CONSTRAINT "reservation_station_stays_evacuatedById_fkey" FOREIGN KEY ("evacuatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
