-- CreateEnum
CREATE TYPE "LodgingCenterKind" AS ENUM ('GUESTHOUSE', 'DORMITORY', 'LODGING', 'OTHER');

-- CreateEnum
CREATE TYPE "LinenSupplyStatus" AS ENUM ('SUFFICIENT', 'INSUFFICIENT', 'NEEDS_SUPPLY');

-- CreateEnum
CREATE TYPE "CleaningServiceKind" AS ENUM ('INTERNAL', 'ORGANIZATION', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "AssemblyCenterKind" AS ENUM ('CULTURAL', 'CONFERENCE', 'ASSEMBLY', 'MULTIPURPOSE');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('SUITABLE', 'CONDITIONAL', 'UNSUITABLE');

-- CreateEnum
CREATE TYPE "SportsComplexKind" AS ENUM ('SPORTS', 'MULTIPURPOSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalTriState" AS ENUM ('YES', 'NO', 'NEEDS_APPROVAL');

-- CreateEnum
CREATE TYPE "EmergencyExitStatus" AS ENUM ('SUITABLE', 'NEEDS_FIX', 'UNSUITABLE');

-- CreateEnum
CREATE TYPE "FlooringCondition" AS ENUM ('SOUND', 'DAMAGED', 'SLIPPERY');

-- CreateEnum
CREATE TYPE "UnknownSuitabilityStatus" AS ENUM ('SUITABLE', 'UNSUITABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KitchenStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISTRIBUTION_ONLY');

-- CreateEnum
CREATE TYPE "MosqueManagerLocationKind" AS ENUM ('OFFICE', 'PRAYER_HALL', 'SIDE_ROOM', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolKind" AS ENUM ('PUBLIC', 'PRIVATE', 'VOCATIONAL', 'OTHER');

-- AlterTable
ALTER TABLE "accommodations"
ADD COLUMN "lodgingCenterKind" "LodgingCenterKind",
ADD COLUMN "lodgingBuildingCount" INTEGER,
ADD COLUMN "lodgingFloorCount" INTEGER,
ADD COLUMN "lodgingRoomCount" INTEGER,
ADD COLUMN "lodgingFixedBedCount" INTEGER,
ADD COLUMN "lodgingUsableBedCount" INTEGER,
ADD COLUMN "lodgingSingleRoomCount" INTEGER,
ADD COLUMN "lodgingMultiRoomCount" INTEGER,
ADD COLUMN "lodgingRoomCapacities" JSONB,
ADD COLUMN "lodgingAssignableRoomCount" INTEGER,
ADD COLUMN "lodgingOutOfServiceRoomCount" INTEGER,
ADD COLUMN "lodgingPrivateBathroomCount" INTEGER,
ADD COLUMN "lodgingSharedBathroomCount" INTEGER,
ADD COLUMN "lodgingBathCount" INTEGER,
ADD COLUMN "lodgingLinenStatus" "LinenSupplyStatus",
ADD COLUMN "lodgingCanWashLinen" BOOLEAN,
ADD COLUMN "lodgingHvacStatus" TEXT,
ADD COLUMN "lodgingElevatorCount" INTEGER,
ADD COLUMN "lodgingElevatorStatus" TEXT,
ADD COLUMN "lodgingStepFreeAccess" BOOLEAN,
ADD COLUMN "lodgingLuggageStorage" TEXT,
ADD COLUMN "lodgingCleaningService" "CleaningServiceKind",
ADD COLUMN "lodgingNightReception" BOOLEAN,
ADD COLUMN "lodgingLockStatus" TEXT,
ADD COLUMN "lodgingOperationTerms" TEXT,
ADD COLUMN "lodgingRoomEquipment" TEXT,
ADD COLUMN "lodgingFinalApprovedCapacity" INTEGER,
ADD COLUMN "assemblyCenterKind" "AssemblyCenterKind",
ADD COLUMN "assemblyMainHallArea" INTEGER,
ADD COLUMN "assemblySideHallCount" INTEGER,
ADD COLUMN "assemblyFixedSeatCount" INTEGER,
ADD COLUMN "assemblySeatsRemovable" BOOLEAN,
ADD COLUMN "assemblyUsableAreaAfterRemoval" INTEGER,
ADD COLUMN "assemblySideRoomCount" INTEGER,
ADD COLUMN "assemblyHasStage" BOOLEAN,
ADD COLUMN "assemblyHasBackstage" BOOLEAN,
ADD COLUMN "assemblyToiletCount" INTEGER,
ADD COLUMN "assemblyAvSystem" TEXT,
ADD COLUMN "assemblyVentilationStatus" "ConditionStatus",
ADD COLUMN "assemblyAvStorage" TEXT,
ADD COLUMN "assemblyEventSchedule" TEXT,
ADD COLUMN "assemblyCanSplitSpace" BOOLEAN,
ADD COLUMN "assemblyFinalApprovedCapacity" INTEGER,
ADD COLUMN "assemblyOperatorRestrictions" TEXT,
ADD COLUMN "sportsComplexKind" "SportsComplexKind",
ADD COLUMN "sportsOperatorName" TEXT,
ADD COLUMN "sportsMainFloorArea" INTEGER,
ADD COLUMN "sportsIndependentHallCount" INTEGER,
ADD COLUMN "sportsSpectatorSeatCount" INTEGER,
ADD COLUMN "sportsSpectatorStayUse" "ApprovalTriState",
ADD COLUMN "sportsShowerCount" INTEGER,
ADD COLUMN "sportsToiletCount" INTEGER,
ADD COLUMN "sportsEntryExitCount" INTEGER,
ADD COLUMN "sportsEmergencyExitStatus" "EmergencyExitStatus",
ADD COLUMN "sportsFlooringCondition" "FlooringCondition",
ADD COLUMN "sportsFloorCovering" TEXT,
ADD COLUMN "sportsHasEquipmentStorage" BOOLEAN,
ADD COLUMN "sportsVentilation" TEXT,
ADD COLUMN "sportsHvacStatus" TEXT,
ADD COLUMN "sportsEmergencyLighting" "UnknownSuitabilityStatus",
ADD COLUMN "sportsFireStatus" TEXT,
ADD COLUMN "sportsProposedCapacity" INTEGER,
ADD COLUMN "sportsFinalApprovedCapacity" INTEGER,
ADD COLUMN "sportsHasReceptionDesk" BOOLEAN,
ADD COLUMN "husseiniehManagerName" TEXT,
ADD COLUMN "husseiniehMainHallArea" INTEGER,
ADD COLUMN "husseiniehSideHallCount" INTEGER,
ADD COLUMN "husseiniehSideHallAreas" TEXT,
ADD COLUMN "husseiniehFloorCount" INTEGER,
ADD COLUMN "husseiniehBalconyCount" INTEGER,
ADD COLUMN "husseiniehBalconyStayUse" "ApprovalTriState",
ADD COLUMN "husseiniehMainHallCapacity" INTEGER,
ADD COLUMN "husseiniehSideRoomCount" INTEGER,
ADD COLUMN "husseiniehHasStaffRoom" BOOLEAN,
ADD COLUMN "husseiniehHasStorage" BOOLEAN,
ADD COLUMN "husseiniehHasKitchen" BOOLEAN,
ADD COLUMN "husseiniehKitchenStatus" "KitchenStatus",
ADD COLUMN "husseiniehAudioStatus" "ConditionStatus",
ADD COLUMN "husseiniehCeremonyHours" JSONB,
ADD COLUMN "husseiniehGenderSeparation" TEXT,
ADD COLUMN "husseiniehToiletStatus" TEXT,
ADD COLUMN "husseiniehVentilationStatus" "ConditionStatus",
ADD COLUMN "husseiniehCanBringSupplies" BOOLEAN,
ADD COLUMN "husseiniehTrusteeRestrictions" TEXT,
ADD COLUMN "mosqueTrusteeName" TEXT,
ADD COLUMN "mosqueHallCount" INTEGER,
ADD COLUMN "mosqueFloorCount" INTEGER,
ADD COLUMN "mosqueAssignableArea" INTEGER,
ADD COLUMN "mosqueHallApprovedCapacity" INTEGER,
ADD COLUMN "mosqueHasSistersSpace" BOOLEAN,
ADD COLUMN "mosqueHasBrothersSpace" BOOLEAN,
ADD COLUMN "mosqueBanHours" JSONB,
ADD COLUMN "mosqueReligiousSchedule" TEXT,
ADD COLUMN "mosqueToiletCount" INTEGER,
ADD COLUMN "mosqueAblutionCount" INTEGER,
ADD COLUMN "mosqueHotWaterStatus" "UnknownSuitabilityStatus",
ADD COLUMN "mosqueHasShoeStorage" BOOLEAN,
ADD COLUMN "mosqueHasStorage" BOOLEAN,
ADD COLUMN "mosqueKitchenRestriction" TEXT,
ADD COLUMN "mosqueSpeakerRestriction" TEXT,
ADD COLUMN "mosqueTrusteeRules" TEXT,
ADD COLUMN "mosqueManagerLocationKind" "MosqueManagerLocationKind",
ADD COLUMN "mosqueManagerLocationText" TEXT,
ADD COLUMN "schoolKind" "SchoolKind",
ADD COLUMN "schoolFloorCount" INTEGER,
ADD COLUMN "schoolBuildingCount" INTEGER,
ADD COLUMN "schoolTotalClassroomCount" INTEGER,
ADD COLUMN "schoolUsableClassroomCount" INTEGER,
ADD COLUMN "schoolUsableHallCount" INTEGER,
ADD COLUMN "schoolPrayerRoomCount" INTEGER,
ADD COLUMN "schoolAssignableOfficeCount" INTEGER,
ADD COLUMN "schoolClassroomApprovedCapacity" INTEGER,
ADD COLUMN "schoolAllowedStayFloors" INTEGER,
ADD COLUMN "schoolToiletCount" INTEGER,
ADD COLUMN "schoolWashStatus" "ConditionStatus",
ADD COLUMN "schoolHvacStatus" "ConditionStatus",
ADD COLUMN "schoolManagerUserId" TEXT,
ADD COLUMN "schoolManagerName" TEXT,
ADD COLUMN "schoolEquipmentHandoverImageId" TEXT,
ADD COLUMN "schoolFinalHandoverImageId" TEXT;

-- CreateIndex
CREATE INDEX "accommodations_schoolManagerUserId_idx" ON "accommodations"("schoolManagerUserId");

-- CreateIndex
CREATE INDEX "accommodations_schoolEquipmentHandoverImageId_idx" ON "accommodations"("schoolEquipmentHandoverImageId");

-- CreateIndex
CREATE INDEX "accommodations_schoolFinalHandoverImageId_idx" ON "accommodations"("schoolFinalHandoverImageId");

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_schoolManagerUserId_fkey" FOREIGN KEY ("schoolManagerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_schoolEquipmentHandoverImageId_fkey" FOREIGN KEY ("schoolEquipmentHandoverImageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_schoolFinalHandoverImageId_fkey" FOREIGN KEY ("schoolFinalHandoverImageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
