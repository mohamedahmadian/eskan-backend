-- CreateEnum
CREATE TYPE "MedicalActivityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PARTIALLY_ACTIVE');

-- CreateEnum
CREATE TYPE "BoardingCenterKind" AS ENUM ('BOARDING', 'STUDENT_DORM', 'EDUCATIONAL_CENTER');

-- CreateEnum
CREATE TYPE "TentStructureKind" AS ENUM ('TENT', 'TEMPORARY_STRUCTURE', 'CONTAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "TentFlooringKind" AS ENUM ('SOIL', 'ASPHALT', 'CONCRETE', 'COVERING', 'OTHER');

-- CreateEnum
CREATE TYPE "DrainageStatus" AS ENUM ('SUITABLE', 'UNSUITABLE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "WindResistanceStatus" AS ENUM ('NEEDS_ASSESSMENT', 'APPROVED', 'UNSUITABLE');

-- CreateEnum
CREATE TYPE "WaterSourceKind" AS ENUM ('NETWORK', 'TANK', 'OTHER');

-- CreateEnum
CREATE TYPE "LightingStatus" AS ENUM ('SUITABLE', 'UNSUITABLE');

-- AlterTable
ALTER TABLE "accommodations"
ADD COLUMN "medicalActivityStatus" "MedicalActivityStatus",
ADD COLUMN "medicalAllowedSections" TEXT,
ADD COLUMN "medicalForbiddenSections" TEXT,
ADD COLUMN "medicalWrittenApprovalImageId" TEXT,
ADD COLUMN "medicalHygieneSafetyStatus" TEXT,
ADD COLUMN "medicalApprovedCapacity" INTEGER,
ADD COLUMN "medicalSanitaryFacilities" TEXT,
ADD COLUMN "medicalSpecializedRestrictions" TEXT,
ADD COLUMN "medicalApproverName" TEXT,
ADD COLUMN "boardingCenterKind" "BoardingCenterKind",
ADD COLUMN "boardingBlockCount" INTEGER,
ADD COLUMN "boardingRoomCount" INTEGER,
ADD COLUMN "boardingFixedBedCount" INTEGER,
ADD COLUMN "boardingUsableBedCount" INTEGER,
ADD COLUMN "boardingPrivateBathroomRoomCount" INTEGER,
ADD COLUMN "boardingSharedBathToiletCount" INTEGER,
ADD COLUMN "boardingHasDiningHall" BOOLEAN,
ADD COLUMN "boardingHasKitchen" BOOLEAN,
ADD COLUMN "boardingHasLaundry" BOOLEAN,
ADD COLUMN "boardingHasStudyOrHall" BOOLEAN,
ADD COLUMN "boardingAccessControl" TEXT,
ADD COLUMN "boardingPersonalStorage" TEXT,
ADD COLUMN "boardingCanAssignFully" BOOLEAN,
ADD COLUMN "boardingUnassignableSections" TEXT,
ADD COLUMN "boardingApprovedCapacity" INTEGER,
ADD COLUMN "boardingRepresentativeName" TEXT,
ADD COLUMN "tentStructureKind" "TentStructureKind",
ADD COLUMN "tentInstalledCount" INTEGER,
ADD COLUMN "tentIntactCount" INTEGER,
ADD COLUMN "tentApprovedCapacityEach" INTEGER,
ADD COLUMN "tentAreaEach" INTEGER,
ADD COLUMN "tentFlooringKind" "TentFlooringKind",
ADD COLUMN "tentDrainageStatus" "DrainageStatus",
ADD COLUMN "tentWindResistanceStatus" "WindResistanceStatus",
ADD COLUMN "tentHvacStatus" TEXT,
ADD COLUMN "tentWaterSource" "WaterSourceKind",
ADD COLUMN "tentWaterHealthStatus" TEXT,
ADD COLUMN "tentToiletCount" INTEGER,
ADD COLUMN "tentWasteLocation" TEXT,
ADD COLUMN "tentPublicLighting" "LightingStatus",
ADD COLUMN "tentExitPathLighting" "LightingStatus",
ADD COLUMN "tentEmergencyVehicleAccess" BOOLEAN,
ADD COLUMN "tentSafeAssemblyPoint" TEXT,
ADD COLUMN "tentFireEquipment" TEXT,
ADD COLUMN "tentMaintenanceManager" TEXT,
ADD COLUMN "tentFinalApprovedCapacity" INTEGER;

-- CreateIndex
CREATE INDEX "accommodations_medicalWrittenApprovalImageId_idx" ON "accommodations"("medicalWrittenApprovalImageId");

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_medicalWrittenApprovalImageId_fkey" FOREIGN KEY ("medicalWrittenApprovalImageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
