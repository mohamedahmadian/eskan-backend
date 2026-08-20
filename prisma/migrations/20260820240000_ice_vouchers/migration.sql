-- CreateEnum
CREATE TYPE "IceVoucherStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ice_voucher_settings" (
    "id" TEXT NOT NULL,
    "moldsPer50Pilgrims" INTEGER NOT NULL DEFAULT 1,
    "costPerMold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ice_voucher_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ice_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "accommodationManagerId" TEXT NOT NULL,
    "requestedAt" DATE NOT NULL,
    "moldCount" INTEGER NOT NULL,
    "costPerMold" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "description" TEXT,
    "status" "IceVoucherStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ice_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ice_vouchers_code_key" ON "ice_vouchers"("code");

-- CreateIndex
CREATE INDEX "ice_vouchers_year_idx" ON "ice_vouchers"("year");

-- CreateIndex
CREATE INDEX "ice_vouchers_accommodationId_idx" ON "ice_vouchers"("accommodationId");

-- CreateIndex
CREATE INDEX "ice_vouchers_accommodationManagerId_idx" ON "ice_vouchers"("accommodationManagerId");

-- CreateIndex
CREATE INDEX "ice_vouchers_status_requestedAt_idx" ON "ice_vouchers"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "ice_vouchers" ADD CONSTRAINT "ice_vouchers_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ice_vouchers" ADD CONSTRAINT "ice_vouchers_accommodationManagerId_fkey" FOREIGN KEY ("accommodationManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ice_vouchers" ADD CONSTRAINT "ice_vouchers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ice_voucher_settings" ("id", "moldsPer50Pilgrims", "costPerMold", "createdAt", "updatedAt")
VALUES ('default', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
