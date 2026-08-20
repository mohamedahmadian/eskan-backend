ALTER TABLE "accommodation_managers" ADD COLUMN "year" INTEGER;

UPDATE "accommodation_managers" SET "year" = 1405 WHERE "year" IS NULL;

ALTER TABLE "accommodation_managers" ALTER COLUMN "year" SET NOT NULL;

DROP INDEX "accommodation_managers_accommodationId_userId_key";

CREATE UNIQUE INDEX "accommodation_managers_userId_accommodationId_year_key" ON "accommodation_managers"("userId", "accommodationId", "year");

DROP INDEX "accommodation_managers_user_primary_key";

CREATE UNIQUE INDEX "accommodation_managers_user_year_primary_key" ON "accommodation_managers"("userId", "year") WHERE "isPrimary" = true;

CREATE INDEX "accommodation_managers_year_idx" ON "accommodation_managers"("year");
