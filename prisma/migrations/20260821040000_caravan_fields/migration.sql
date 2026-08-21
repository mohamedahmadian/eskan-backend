-- Drop stub caravan rows that cannot map to the new required city FK.
DELETE FROM "caravans";

-- AlterTable
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "originCity";
ALTER TABLE "caravans" DROP COLUMN IF EXISTS "plannedArrival";

ALTER TABLE "caravans" ADD COLUMN "description" TEXT;
ALTER TABLE "caravans" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "caravans" ADD COLUMN "cityId" TEXT NOT NULL;
ALTER TABLE "caravans" ADD COLUMN "licenseImageId" TEXT;
ALTER TABLE "caravans" ADD COLUMN "managerUserId" TEXT;
ALTER TABLE "caravans" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "caravans_cityId_idx" ON "caravans"("cityId");
CREATE INDEX "caravans_managerUserId_idx" ON "caravans"("managerUserId");
CREATE INDEX "caravans_isActive_idx" ON "caravans"("isActive");

-- AddForeignKey
ALTER TABLE "caravans" ADD CONSTRAINT "caravans_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "caravans" ADD CONSTRAINT "caravans_licenseImageId_fkey" FOREIGN KEY ("licenseImageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "caravans" ADD CONSTRAINT "caravans_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
