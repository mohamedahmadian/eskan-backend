-- AlterEnum
ALTER TYPE "IssuedLicenseStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "issued_licenses" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT;

-- CreateIndex
CREATE INDEX "issued_licenses_approvedById_idx" ON "issued_licenses"("approvedById");

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
