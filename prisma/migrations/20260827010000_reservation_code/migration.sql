-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "code" TEXT;
ALTER TABLE "reservations" ADD COLUMN "codeSeq" INTEGER;

-- Backfill sequential codes per Jalali year (oldest first)
WITH numbered AS (
  SELECT
    id,
    year,
    ROW_NUMBER() OVER (PARTITION BY year ORDER BY "createdAt" ASC, id ASC)::INTEGER AS seq
  FROM "reservations"
)
UPDATE "reservations" AS r
SET
  "codeSeq" = n.seq,
  "code" = n.year::text || '-' || n.seq::text
FROM numbered n
WHERE r.id = n.id;

-- Empty table: leave columns nullable until NOT NULL; no rows means skip is fine
UPDATE "reservations"
SET
  "codeSeq" = 1,
  "code" = year::text || '-1'
WHERE "code" IS NULL;

ALTER TABLE "reservations" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "reservations" ALTER COLUMN "codeSeq" SET NOT NULL;

CREATE UNIQUE INDEX "reservations_code_key" ON "reservations"("code");
CREATE UNIQUE INDEX "reservations_year_codeSeq_key" ON "reservations"("year", "codeSeq");
