-- CreateEnum
CREATE TYPE "EntryBorderType" AS ENUM ('LAND', 'AIR', 'SEA');

-- CreateTable
CREATE TABLE "entry_borders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "neighboringCountryId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "borderType" "EntryBorderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entry_borders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entry_borders_name_idx" ON "entry_borders"("name");

-- CreateIndex
CREATE INDEX "entry_borders_neighboringCountryId_idx" ON "entry_borders"("neighboringCountryId");

-- CreateIndex
CREATE INDEX "entry_borders_provinceId_idx" ON "entry_borders"("provinceId");

-- CreateIndex
CREATE INDEX "entry_borders_cityId_idx" ON "entry_borders"("cityId");

-- CreateIndex
CREATE INDEX "entry_borders_borderType_idx" ON "entry_borders"("borderType");

-- CreateIndex
CREATE INDEX "entry_borders_isActive_idx" ON "entry_borders"("isActive");

-- AddForeignKey
ALTER TABLE "entry_borders" ADD CONSTRAINT "entry_borders_neighboringCountryId_fkey" FOREIGN KEY ("neighboringCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_borders" ADD CONSTRAINT "entry_borders_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_borders" ADD CONSTRAINT "entry_borders_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
