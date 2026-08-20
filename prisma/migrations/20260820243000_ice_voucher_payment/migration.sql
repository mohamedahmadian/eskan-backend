-- CreateEnum
CREATE TYPE "IceVoucherPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "ice_vouchers" ADD COLUMN "paymentStatus" "IceVoucherPaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "ice_vouchers" ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ice_vouchers_paymentStatus_idx" ON "ice_vouchers"("paymentStatus");
