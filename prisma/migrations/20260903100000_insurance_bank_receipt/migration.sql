-- AlterEnum
ALTER TYPE "ReservationMemberInsurancePaidMethod" ADD VALUE 'BANK_RECEIPT';

-- AlterTable
ALTER TABLE "reception_settings" ADD COLUMN "insuranceBankAccountId" TEXT;

-- AlterTable
ALTER TABLE "reservation_members" ADD COLUMN "insuranceReceiptDate" DATE;
ALTER TABLE "reservation_members" ADD COLUMN "insuranceReceiptBankName" TEXT;

-- CreateIndex
CREATE INDEX "reception_settings_insuranceBankAccountId_idx" ON "reception_settings"("insuranceBankAccountId");

-- AddForeignKey
ALTER TABLE "reception_settings" ADD CONSTRAINT "reception_settings_insuranceBankAccountId_fkey" FOREIGN KEY ("insuranceBankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
