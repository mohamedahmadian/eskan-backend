-- AlterTable: org_unit_accommodation_liaisons (userId → role)
ALTER TABLE "org_unit_accommodation_liaisons" DROP CONSTRAINT "org_unit_accommodation_liaisons_userId_fkey";

DROP INDEX "org_unit_accommodation_liaisons_unitId_userId_key";
DROP INDEX "org_unit_accommodation_liaisons_userId_idx";

ALTER TABLE "org_unit_accommodation_liaisons" DROP COLUMN "userId";
ALTER TABLE "org_unit_accommodation_liaisons" ADD COLUMN "role" "AccommodationContactRole" NOT NULL;

CREATE INDEX "org_unit_accommodation_liaisons_role_idx" ON "org_unit_accommodation_liaisons"("role");
CREATE UNIQUE INDEX "org_unit_accommodation_liaisons_unitId_role_key" ON "org_unit_accommodation_liaisons"("unitId", "role");

-- AlterTable: org_unit_caravan_liaisons (userId → role)
ALTER TABLE "org_unit_caravan_liaisons" DROP CONSTRAINT "org_unit_caravan_liaisons_userId_fkey";

DROP INDEX "org_unit_caravan_liaisons_unitId_userId_key";
DROP INDEX "org_unit_caravan_liaisons_userId_idx";

ALTER TABLE "org_unit_caravan_liaisons" DROP COLUMN "userId";
ALTER TABLE "org_unit_caravan_liaisons" ADD COLUMN "role" "CaravanContactRole" NOT NULL;

CREATE INDEX "org_unit_caravan_liaisons_role_idx" ON "org_unit_caravan_liaisons"("role");
CREATE UNIQUE INDEX "org_unit_caravan_liaisons_unitId_role_key" ON "org_unit_caravan_liaisons"("unitId", "role");
