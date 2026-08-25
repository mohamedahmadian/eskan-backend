-- CreateTable
CREATE TABLE "caravan_years" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "managerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caravan_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "caravan_years_caravanId_year_key" ON "caravan_years"("caravanId", "year");

-- CreateIndex
CREATE INDEX "caravan_years_year_idx" ON "caravan_years"("year");

-- CreateIndex
CREATE INDEX "caravan_years_caravanId_year_idx" ON "caravan_years"("caravanId", "year");

-- CreateIndex
CREATE INDEX "caravan_years_managerUserId_idx" ON "caravan_years"("managerUserId");

-- AddForeignKey
ALTER TABLE "caravan_years" ADD CONSTRAINT "caravan_years_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "caravans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caravan_years" ADD CONSTRAINT "caravan_years_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill current Jalali year (1405) for existing caravans
INSERT INTO "caravan_years" ("id", "caravanId", "year", "managerUserId", "createdAt")
SELECT gen_random_uuid()::text, "id", 1405, "managerUserId", CURRENT_TIMESTAMP
FROM "caravans";
