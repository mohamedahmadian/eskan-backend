-- AlterTable
ALTER TABLE "caravans" ADD COLUMN "walkingRouteId" TEXT;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN "walkingRouteId" TEXT;

-- CreateIndex
CREATE INDEX "caravans_walkingRouteId_idx" ON "caravans"("walkingRouteId");

-- CreateIndex
CREATE INDEX "groups_walkingRouteId_idx" ON "groups"("walkingRouteId");

-- AddForeignKey
ALTER TABLE "caravans" ADD CONSTRAINT "caravans_walkingRouteId_fkey" FOREIGN KEY ("walkingRouteId") REFERENCES "walking_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_walkingRouteId_fkey" FOREIGN KEY ("walkingRouteId") REFERENCES "walking_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
