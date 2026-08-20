-- CreateEnum
CREATE TYPE "ManagementType" AS ENUM ('SELF_SUFFICIENT', 'SEMI_SELF_SUFFICIENT', 'NON_SELF_SUFFICIENT');

-- AlterTable
ALTER TABLE "accommodations" ADD COLUMN "managementType" "ManagementType" NOT NULL DEFAULT 'SELF_SUFFICIENT';

-- CreateIndex
CREATE INDEX "accommodations_managementType_genderType_idx" ON "accommodations"("managementType", "genderType");
