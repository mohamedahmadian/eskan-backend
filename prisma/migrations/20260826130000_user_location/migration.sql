-- AlterTable
ALTER TABLE "users" ADD COLUMN "locationProvinceId" TEXT;
ALTER TABLE "users" ADD COLUMN "locationCityId" TEXT;
ALTER TABLE "users" ADD COLUMN "latitude" DECIMAL(10,7);
ALTER TABLE "users" ADD COLUMN "longitude" DECIMAL(10,7);
ALTER TABLE "users" ADD COLUMN "locationNotes" TEXT;
ALTER TABLE "users" ADD COLUMN "locationUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_locationProvinceId_idx" ON "users"("locationProvinceId");
CREATE INDEX "users_locationCityId_idx" ON "users"("locationCityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_locationProvinceId_fkey" FOREIGN KEY ("locationProvinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_locationCityId_fkey" FOREIGN KEY ("locationCityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
