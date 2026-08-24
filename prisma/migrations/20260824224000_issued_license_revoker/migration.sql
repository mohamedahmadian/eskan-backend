-- AlterTable
ALTER TABLE "issued_licenses" ADD COLUMN "revokedById" TEXT;

-- CreateIndex
CREATE INDEX "issued_licenses_revokedById_idx" ON "issued_licenses"("revokedById");

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
