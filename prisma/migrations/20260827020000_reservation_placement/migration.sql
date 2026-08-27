-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PARTIAL', 'PLACED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'VACATED');

-- CreateEnum
CREATE TYPE "AllocationSource" AS ENUM ('SYSTEM', 'MANUAL', 'HYBRID');

-- AlterTable
ALTER TABLE "accommodations" ADD COLUMN "overflowPercent" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "placementStatus" "PlacementStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "reservations" ADD COLUMN "placementCompletedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "placementCompletedById" TEXT;

-- CreateTable
CREATE TABLE "reservation_allocations" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "gender" "UserGender" NOT NULL,
    "headcount" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "AllocationSource" NOT NULL,
    "genderOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideNote" TEXT,
    "notes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placedById" TEXT NOT NULL,
    "vacatedAt" TIMESTAMP(3),
    "vacatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_allocations_reservationId_idx" ON "reservation_allocations"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_allocations_accommodationId_idx" ON "reservation_allocations"("accommodationId");

-- CreateIndex
CREATE INDEX "reservation_allocations_status_idx" ON "reservation_allocations"("status");

-- CreateIndex
CREATE INDEX "reservation_allocations_placedAt_idx" ON "reservation_allocations"("placedAt");

-- CreateIndex
CREATE INDEX "reservation_allocations_reservationId_status_idx" ON "reservation_allocations"("reservationId", "status");

-- CreateIndex
CREATE INDEX "reservation_allocations_accommodationId_status_gender_idx" ON "reservation_allocations"("accommodationId", "status", "gender");

-- CreateIndex
CREATE INDEX "reservations_placementStatus_idx" ON "reservations"("placementStatus");

-- CreateIndex
CREATE INDEX "reservations_year_placementStatus_idx" ON "reservations"("year", "placementStatus");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_placementCompletedById_fkey" FOREIGN KEY ("placementCompletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_vacatedById_fkey" FOREIGN KEY ("vacatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "reservations"
SET "placementStatus" = 'PENDING'
WHERE "status" = 'COMPLETED' AND "requestsAccommodation" = true;

UPDATE "reservations"
SET "placementStatus" = 'NOT_REQUIRED'
WHERE "status" = 'COMPLETED' AND "requestsAccommodation" = false;
