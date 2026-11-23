-- CreateEnum
CREATE TYPE "AccommodationInspectionStatus" AS ENUM ('NOT_DONE', 'PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "AccommodationInspectionResult" AS ENUM ('APPROVED', 'CONDITIONAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccommodationOperationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EMERGENCY', 'OUT_OF_CYCLE');

-- AlterTable
ALTER TABLE "accommodations"
ADD COLUMN "ownerName" TEXT,
ADD COLUMN "ownerPhone" TEXT,
ADD COLUMN "inspectionStatus" "AccommodationInspectionStatus" NOT NULL DEFAULT 'NOT_DONE',
ADD COLUMN "inspectionResult" "AccommodationInspectionResult",
ADD COLUMN "reviewerId" TEXT,
ADD COLUMN "lastEvaluatedAt" DATE,
ADD COLUMN "operationStatus" "AccommodationOperationStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "accommodation_images" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accommodation_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_evaluations" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "inspectionStatus" "AccommodationInspectionStatus" NOT NULL,
    "inspectionResult" "AccommodationInspectionResult",
    "reviewerId" TEXT,
    "evaluatedAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accommodation_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accommodation_images_accommodationId_sortOrder_idx" ON "accommodation_images"("accommodationId", "sortOrder");

-- CreateIndex
CREATE INDEX "accommodation_images_imageId_idx" ON "accommodation_images"("imageId");

-- CreateIndex
CREATE INDEX "accommodation_evaluations_accommodationId_evaluatedAt_idx" ON "accommodation_evaluations"("accommodationId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "accommodation_evaluations_reviewerId_idx" ON "accommodation_evaluations"("reviewerId");

-- CreateIndex
CREATE INDEX "accommodations_reviewerId_idx" ON "accommodations"("reviewerId");

-- CreateIndex
CREATE INDEX "accommodations_inspectionStatus_idx" ON "accommodations"("inspectionStatus");

-- CreateIndex
CREATE INDEX "accommodations_operationStatus_idx" ON "accommodations"("operationStatus");

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_images" ADD CONSTRAINT "accommodation_images_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_images" ADD CONSTRAINT "accommodation_images_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "stored_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_evaluations" ADD CONSTRAINT "accommodation_evaluations_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_evaluations" ADD CONSTRAINT "accommodation_evaluations_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
