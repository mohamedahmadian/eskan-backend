-- CreateTable
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "returnDate" DATE,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_loans" (
    "id" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "accommodationManagerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "plannedReturnDate" DATE,
    "actualReturnDate" DATE,
    "returnedQuantity" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_items_supplierId_year_idx" ON "supplier_items"("supplierId", "year");

-- CreateIndex
CREATE INDEX "supplier_items_year_idx" ON "supplier_items"("year");

-- CreateIndex
CREATE INDEX "supplier_items_name_idx" ON "supplier_items"("name");

-- CreateIndex
CREATE INDEX "accommodation_loans_supplierItemId_idx" ON "accommodation_loans"("supplierItemId");

-- CreateIndex
CREATE INDEX "accommodation_loans_accommodationManagerId_idx" ON "accommodation_loans"("accommodationManagerId");

-- CreateIndex
CREATE INDEX "accommodation_loans_deliveryDate_idx" ON "accommodation_loans"("deliveryDate");

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_loans" ADD CONSTRAINT "accommodation_loans_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_loans" ADD CONSTRAINT "accommodation_loans_accommodationManagerId_fkey" FOREIGN KEY ("accommodationManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
