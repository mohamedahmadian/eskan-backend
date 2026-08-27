-- CreateEnum
CREATE TYPE "PlacementMode" AS ENUM ('MANUAL', 'SYSTEM');

-- AlterTable
ALTER TABLE "reception_settings" ADD COLUMN "individualPlacementMode" "PlacementMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "reception_settings" ADD COLUMN "groupPlacementMode" "PlacementMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "reception_settings" ADD COLUMN "caravanPlacementMode" "PlacementMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "placementMode" "PlacementMode" NOT NULL DEFAULT 'MANUAL';
