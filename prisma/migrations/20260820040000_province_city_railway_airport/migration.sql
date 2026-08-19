-- AlterTable
ALTER TABLE "provinces" ADD COLUMN "hasRailway" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasAirport" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "hasRailway" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasAirport" BOOLEAN NOT NULL DEFAULT false;
