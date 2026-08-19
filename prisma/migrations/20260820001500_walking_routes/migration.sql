-- CreateTable
CREATE TABLE "walking_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distanceToMashhadKm" DECIMAL(8,2) NOT NULL,
    "entryBorderCityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "walking_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "walking_route_origin_countries" (
    "walkingRouteId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "walking_route_origin_countries_pkey" PRIMARY KEY ("walkingRouteId","countryId")
);

-- CreateTable
CREATE TABLE "walking_route_stages" (
    "id" TEXT NOT NULL,
    "walkingRouteId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "distanceToNextKm" DECIMAL(8,2),
    "distanceToPreviousKm" DECIMAL(8,2),
    "distanceToMashhadKm" DECIMAL(8,2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "walking_route_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "walking_routes_name_idx" ON "walking_routes"("name");

-- CreateIndex
CREATE INDEX "walking_routes_entryBorderCityId_idx" ON "walking_routes"("entryBorderCityId");

-- CreateIndex
CREATE INDEX "walking_route_origin_countries_countryId_idx" ON "walking_route_origin_countries"("countryId");

-- CreateIndex
CREATE INDEX "walking_route_stages_cityId_idx" ON "walking_route_stages"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "walking_route_stages_walkingRouteId_stageNumber_key" ON "walking_route_stages"("walkingRouteId", "stageNumber");

-- AddForeignKey
ALTER TABLE "walking_routes" ADD CONSTRAINT "walking_routes_entryBorderCityId_fkey" FOREIGN KEY ("entryBorderCityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walking_route_origin_countries" ADD CONSTRAINT "walking_route_origin_countries_walkingRouteId_fkey" FOREIGN KEY ("walkingRouteId") REFERENCES "walking_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walking_route_origin_countries" ADD CONSTRAINT "walking_route_origin_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walking_route_stages" ADD CONSTRAINT "walking_route_stages_walkingRouteId_fkey" FOREIGN KEY ("walkingRouteId") REFERENCES "walking_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walking_route_stages" ADD CONSTRAINT "walking_route_stages_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
