-- Backfill walking start from the removed travel date, then drop travelDate.
UPDATE "reservations"
SET "walkingStartDate" = COALESCE("walkingStartDate", "travelDate")
WHERE "walkingStartDate" IS NULL;

ALTER TABLE "reservations" ALTER COLUMN "walkingStartDate" SET NOT NULL;

ALTER TABLE "reservations" DROP COLUMN "travelDate";

ALTER TABLE "reservations" ALTER COLUMN "originCityId" DROP NOT NULL;

ALTER TABLE "reservations" DROP CONSTRAINT "reservations_originCityId_fkey";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_originCityId_fkey"
  FOREIGN KEY ("originCityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
