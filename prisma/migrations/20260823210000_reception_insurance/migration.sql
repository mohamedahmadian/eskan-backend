ALTER TABLE "reception_settings"
ADD COLUMN "insuranceOrganization" TEXT NOT NULL DEFAULT '',
ADD COLUMN "insurancePremiumAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "insuranceCoverage" TEXT NOT NULL DEFAULT '';
