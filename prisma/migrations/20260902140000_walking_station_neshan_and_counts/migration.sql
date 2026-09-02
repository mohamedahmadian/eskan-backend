ALTER TABLE "walking_stations" ADD COLUMN "neshanAddress" TEXT;
ALTER TABLE "walking_stations" ADD COLUMN "maleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "walking_stations" ADD COLUMN "femaleCount" INTEGER NOT NULL DEFAULT 0;
