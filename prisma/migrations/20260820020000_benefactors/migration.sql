-- CreateTable
CREATE TABLE "benefactors" (
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

    CONSTRAINT "benefactors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "benefactors_name_idx" ON "benefactors"("name");

-- CreateIndex
CREATE INDEX "benefactors_provinceId_idx" ON "benefactors"("provinceId");

-- CreateIndex
CREATE INDEX "benefactors_cityId_idx" ON "benefactors"("cityId");

-- AddForeignKey
ALTER TABLE "benefactors" ADD CONSTRAINT "benefactors_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefactors" ADD CONSTRAINT "benefactors_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
