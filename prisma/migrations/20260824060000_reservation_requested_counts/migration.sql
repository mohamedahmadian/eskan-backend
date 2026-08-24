ALTER TABLE "reservations"
ADD COLUMN "requestedMaleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "requestedFemaleCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "reservations"
SET "requestedMaleCount" = "maleCount",
    "requestedFemaleCount" = "femaleCount";
