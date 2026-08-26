ALTER TABLE "caravan_years" ADD COLUMN IF NOT EXISTS "maleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "caravan_years" ADD COLUMN IF NOT EXISTS "femaleCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "caravan_years" AS cy
SET
  "maleCount" = c."maleCount",
  "femaleCount" = c."femaleCount"
FROM "caravans" AS c
WHERE cy."caravanId" = c."id";
