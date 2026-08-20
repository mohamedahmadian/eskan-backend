-- CreateTable
CREATE TABLE "item_quotas" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "supplierId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_quota_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "accommodationManagerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "pickupLocation" TEXT,
    "description" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_quota_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_quotas_year_idx" ON "item_quotas"("year");

-- CreateIndex
CREATE INDEX "item_quotas_name_idx" ON "item_quotas"("name");

-- CreateIndex
CREATE INDEX "item_quotas_supplierId_idx" ON "item_quotas"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "item_quota_vouchers_code_key" ON "item_quota_vouchers"("code");

-- CreateIndex
CREATE INDEX "item_quota_vouchers_quotaId_idx" ON "item_quota_vouchers"("quotaId");

-- CreateIndex
CREATE INDEX "item_quota_vouchers_accommodationManagerId_idx" ON "item_quota_vouchers"("accommodationManagerId");

-- CreateIndex
CREATE INDEX "item_quota_vouchers_issuedAt_idx" ON "item_quota_vouchers"("issuedAt");

-- AddForeignKey
ALTER TABLE "item_quotas" ADD CONSTRAINT "item_quotas_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_quota_vouchers" ADD CONSTRAINT "item_quota_vouchers_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "item_quotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_quota_vouchers" ADD CONSTRAINT "item_quota_vouchers_accommodationManagerId_fkey" FOREIGN KEY ("accommodationManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_quota_vouchers" ADD CONSTRAINT "item_quota_vouchers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
