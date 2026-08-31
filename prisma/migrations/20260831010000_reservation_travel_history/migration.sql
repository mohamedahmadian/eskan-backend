-- CreateTable
CREATE TABLE "reservation_travel_histories" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walkingRouteStageId" TEXT,
    "provinceId" TEXT,
    "cityId" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_travel_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_travel_histories_reservationId_createdAt_idx" ON "reservation_travel_histories"("reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "reservation_travel_histories_userId_createdAt_idx" ON "reservation_travel_histories"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reservation_travel_histories_walkingRouteStageId_idx" ON "reservation_travel_histories"("walkingRouteStageId");

-- CreateIndex
CREATE INDEX "reservation_travel_histories_provinceId_idx" ON "reservation_travel_histories"("provinceId");

-- CreateIndex
CREATE INDEX "reservation_travel_histories_cityId_idx" ON "reservation_travel_histories"("cityId");

-- AddForeignKey
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_walkingRouteStageId_fkey" FOREIGN KEY ("walkingRouteStageId") REFERENCES "walking_route_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_travel_histories" ADD CONSTRAINT "reservation_travel_histories_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
