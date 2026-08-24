-- CreateEnum
CREATE TYPE "ReservationPermitStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReservationPermitSource" AS ENUM ('UPLOAD', 'ISSUED_LICENSE');

-- AlterTable
ALTER TABLE "reservations"
ADD COLUMN "hasPermit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permitStatus" "ReservationPermitStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "permitSource" "ReservationPermitSource",
ADD COLUMN "permitImageId" TEXT,
ADD COLUMN "issuedLicenseId" TEXT,
ADD COLUMN "permitReviewedAt" TIMESTAMP(3),
ADD COLUMN "permitReviewedById" TEXT,
ADD COLUMN "permitRejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "reservations_hasPermit_idx" ON "reservations"("hasPermit");

-- CreateIndex
CREATE INDEX "reservations_permitStatus_idx" ON "reservations"("permitStatus");

-- CreateIndex
CREATE INDEX "reservations_issuedLicenseId_idx" ON "reservations"("issuedLicenseId");

-- AddForeignKey
ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_permitImageId_fkey"
FOREIGN KEY ("permitImageId") REFERENCES "stored_images"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_issuedLicenseId_fkey"
FOREIGN KEY ("issuedLicenseId") REFERENCES "issued_licenses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_permitReviewedById_fkey"
FOREIGN KEY ("permitReviewedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
