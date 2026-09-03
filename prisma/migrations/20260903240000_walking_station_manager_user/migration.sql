-- AlterTable
ALTER TABLE "walking_stations" ADD COLUMN "managerUserId" TEXT;

-- CreateIndex
CREATE INDEX "walking_stations_managerUserId_idx" ON "walking_stations"("managerUserId");

-- AddForeignKey
ALTER TABLE "walking_stations" ADD CONSTRAINT "walking_stations_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
