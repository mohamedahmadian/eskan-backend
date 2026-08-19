-- CreateTable
CREATE TABLE "food_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "description" TEXT,
    "provinceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_suppliers_name_idx" ON "food_suppliers"("name");

-- CreateIndex
CREATE INDEX "food_suppliers_provinceId_idx" ON "food_suppliers"("provinceId");

-- CreateIndex
CREATE INDEX "food_suppliers_cityId_idx" ON "food_suppliers"("cityId");

-- AddForeignKey
ALTER TABLE "food_suppliers" ADD CONSTRAINT "food_suppliers_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_suppliers" ADD CONSTRAINT "food_suppliers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
