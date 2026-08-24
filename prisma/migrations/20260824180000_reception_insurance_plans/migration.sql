-- CreateTable
CREATE TABLE "reception_insurance_plans" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "coverageAmount" INTEGER NOT NULL,
    "premiumAmount" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reception_insurance_plans_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single premium/coverage into one plan per year when present
INSERT INTO "reception_insurance_plans" ("id", "year", "coverageAmount", "premiumAmount", "description", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "year",
  0,
  "insurancePremiumAmount",
  "insuranceCoverage",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "reception_settings"
WHERE "insurancePremiumAmount" > 0 OR length(trim("insuranceCoverage")) > 0;

-- AlterTable
ALTER TABLE "reception_settings" DROP COLUMN "insurancePremiumAmount",
DROP COLUMN "insuranceCoverage";

-- AlterTable
ALTER TABLE "reservation_members" ADD COLUMN "insuranceCoverageAmount" INTEGER,
ADD COLUMN "insurancePlanId" TEXT;

-- CreateIndex
CREATE INDEX "reception_insurance_plans_year_idx" ON "reception_insurance_plans"("year");

-- CreateIndex
CREATE INDEX "reservation_members_insurancePlanId_idx" ON "reservation_members"("insurancePlanId");

-- AddForeignKey
ALTER TABLE "reception_insurance_plans" ADD CONSTRAINT "reception_insurance_plans_year_fkey" FOREIGN KEY ("year") REFERENCES "reception_settings"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_members" ADD CONSTRAINT "reservation_members_insurancePlanId_fkey" FOREIGN KEY ("insurancePlanId") REFERENCES "reception_insurance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
