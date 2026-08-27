-- CreateEnum
CREATE TYPE "PlacementGenderPolicy" AS ENUM ('SINGLE_GENDER', 'MIXED');

-- AlterTable
ALTER TABLE "reception_settings" ADD COLUMN "placementGenderPolicy" "PlacementGenderPolicy" NOT NULL DEFAULT 'SINGLE_GENDER';
