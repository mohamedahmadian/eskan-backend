ALTER TABLE "accommodation_managers" ALTER COLUMN "userId" DROP NOT NULL;

CREATE UNIQUE INDEX "accommodation_managers_unassigned_year_key" ON "accommodation_managers"("accommodationId", "year") WHERE "userId" IS NULL;

CREATE INDEX "accommodation_managers_accommodationId_year_idx" ON "accommodation_managers"("accommodationId", "year");
