-- CreateEnum
CREATE TYPE "IssuedLicenseStatus" AS ENUM ('ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "issued_licenses" (
    "id" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "issuerUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "description" TEXT,
    "issuedAt" DATE NOT NULL,
    "status" "IssuedLicenseStatus" NOT NULL DEFAULT 'ISSUED',
    "revokedAt" TIMESTAMP(3),
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issued_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issued_licenses_issuerUserId_idx" ON "issued_licenses"("issuerUserId");

-- CreateIndex
CREATE INDEX "issued_licenses_managerUserId_idx" ON "issued_licenses"("managerUserId");

-- CreateIndex
CREATE INDEX "issued_licenses_caravanId_idx" ON "issued_licenses"("caravanId");

-- CreateIndex
CREATE INDEX "issued_licenses_organizationId_idx" ON "issued_licenses"("organizationId");

-- CreateIndex
CREATE INDEX "issued_licenses_status_idx" ON "issued_licenses"("status");

-- CreateIndex
CREATE INDEX "issued_licenses_issuedAt_idx" ON "issued_licenses"("issuedAt");

-- CreateIndex
CREATE INDEX "issued_licenses_createdAt_idx" ON "issued_licenses"("createdAt");

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "caravans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_issuerUserId_fkey" FOREIGN KEY ("issuerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "government_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_licenses" ADD CONSTRAINT "issued_licenses_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
