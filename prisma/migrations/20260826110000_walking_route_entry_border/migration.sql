-- AlterTable
ALTER TABLE "walking_routes" ADD COLUMN "entryBorderId" TEXT;

-- Create missing entry borders from cities already used as walking-route borders
INSERT INTO "entry_borders" ("id", "name", "neighboringCountryId", "provinceId", "cityId", "borderType", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."nameFa",
  COALESCE(
    (
      SELECT co2."id"
      FROM "countries" co2
      WHERE co2."iso2" <> co."iso2"
      ORDER BY co2."sortOrder" ASC, co2."nameFa" ASC
      LIMIT 1
    ),
    (SELECT co3."id" FROM "countries" co3 ORDER BY co3."sortOrder" ASC LIMIT 1)
  ),
  c."provinceId",
  c."id",
  'LAND'::"EntryBorderType",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cities" c
INNER JOIN "provinces" p ON p."id" = c."provinceId"
INNER JOIN "countries" co ON co."id" = p."countryId"
WHERE c."id" IN (SELECT DISTINCT "entryBorderCityId" FROM "walking_routes")
  AND NOT EXISTS (
    SELECT 1 FROM "entry_borders" eb WHERE eb."cityId" = c."id"
  );

-- Link each route to an entry border in the same city
UPDATE "walking_routes" wr
SET "entryBorderId" = sub."id"
FROM (
  SELECT DISTINCT ON ("cityId") "id", "cityId"
  FROM "entry_borders"
  ORDER BY "cityId", "createdAt" ASC, "id" ASC
) sub
WHERE wr."entryBorderId" IS NULL
  AND sub."cityId" = wr."entryBorderCityId";

-- AlterTable
ALTER TABLE "walking_routes" ALTER COLUMN "entryBorderId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "walking_routes" DROP CONSTRAINT "walking_routes_entryBorderCityId_fkey";

-- DropIndex
DROP INDEX "walking_routes_entryBorderCityId_idx";

-- AlterTable
ALTER TABLE "walking_routes" DROP COLUMN "entryBorderCityId";

-- CreateIndex
CREATE INDEX "walking_routes_entryBorderId_idx" ON "walking_routes"("entryBorderId");

-- AddForeignKey
ALTER TABLE "walking_routes" ADD CONSTRAINT "walking_routes_entryBorderId_fkey" FOREIGN KEY ("entryBorderId") REFERENCES "entry_borders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
