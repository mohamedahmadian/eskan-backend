-- CreateTable
CREATE TABLE "medical_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "neshanAddress" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "description" TEXT,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "red_crescents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "neshanAddress" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "description" TEXT,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "red_crescents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_centers_name_idx" ON "medical_centers"("name");

-- CreateIndex
CREATE INDEX "medical_centers_provinceId_idx" ON "medical_centers"("provinceId");

-- CreateIndex
CREATE INDEX "medical_centers_cityId_idx" ON "medical_centers"("cityId");

-- CreateIndex
CREATE INDEX "red_crescents_name_idx" ON "red_crescents"("name");

-- CreateIndex
CREATE INDEX "red_crescents_provinceId_idx" ON "red_crescents"("provinceId");

-- CreateIndex
CREATE INDEX "red_crescents_cityId_idx" ON "red_crescents"("cityId");

-- AddForeignKey
ALTER TABLE "medical_centers" ADD CONSTRAINT "medical_centers_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_centers" ADD CONSTRAINT "medical_centers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_crescents" ADD CONSTRAINT "red_crescents_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_crescents" ADD CONSTRAINT "red_crescents_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
