-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('MANUAL', 'APP', 'STATION');

-- AlterTable
ALTER TABLE "user_location_histories" ADD COLUMN "source" "LocationSource" NOT NULL DEFAULT 'MANUAL';
