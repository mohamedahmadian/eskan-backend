-- CreateEnum
CREATE TYPE "CaravanStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'INACTIVE');

-- AlterTable
ALTER TABLE "caravans" ADD COLUMN "status" "CaravanStatus";

UPDATE "caravans"
SET "status" = CASE
  WHEN "isActive" THEN 'ACTIVE'::"CaravanStatus"
  ELSE 'INACTIVE'::"CaravanStatus"
END;

ALTER TABLE "caravans" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "caravans" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP INDEX IF EXISTS "caravans_isActive_idx";
ALTER TABLE "caravans" DROP COLUMN "isActive";
CREATE INDEX "caravans_status_idx" ON "caravans"("status");
