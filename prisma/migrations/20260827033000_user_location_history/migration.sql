-- CreateTable
CREATE TABLE "user_location_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provinceId" TEXT,
    "cityId" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_location_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_location_histories_userId_createdAt_idx" ON "user_location_histories"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_location_histories_provinceId_idx" ON "user_location_histories"("provinceId");

-- CreateIndex
CREATE INDEX "user_location_histories_cityId_idx" ON "user_location_histories"("cityId");

-- AddForeignKey
ALTER TABLE "user_location_histories" ADD CONSTRAINT "user_location_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_location_histories" ADD CONSTRAINT "user_location_histories_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_location_histories" ADD CONSTRAINT "user_location_histories_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
