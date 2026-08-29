-- CreateTable
CREATE TABLE "place_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'landmark',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "place_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeTypeId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "neshanAddress" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_types_code_key" ON "place_types"("code");

-- CreateIndex
CREATE INDEX "place_types_isActive_sortOrder_idx" ON "place_types"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "places_name_idx" ON "places"("name");

-- CreateIndex
CREATE INDEX "places_placeTypeId_idx" ON "places"("placeTypeId");

-- CreateIndex
CREATE INDEX "places_provinceId_idx" ON "places"("provinceId");

-- CreateIndex
CREATE INDEX "places_cityId_idx" ON "places"("cityId");

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_placeTypeId_fkey" FOREIGN KEY ("placeTypeId") REFERENCES "place_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
