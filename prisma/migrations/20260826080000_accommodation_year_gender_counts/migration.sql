ALTER TABLE "accommodation_managers" ADD COLUMN "maleCapacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "accommodation_managers" ADD COLUMN "femaleCapacity" INTEGER NOT NULL DEFAULT 0;

UPDATE "accommodation_managers" AS m
SET
  "maleCapacity" = a."maleCapacity",
  "femaleCapacity" = a."femaleCapacity"
FROM "accommodations" AS a
WHERE a.id = m."accommodationId";
