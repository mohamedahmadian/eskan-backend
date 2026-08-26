-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN "performanceRank" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "evaluations_performanceRank_idx" ON "evaluations"("performanceRank");

-- Backfill from existing five-scale answers
UPDATE "evaluations" AS e
SET "performanceRank" = sub.avg_score
FROM (
  SELECT "evaluationId", AVG("score"::double precision) AS avg_score
  FROM "evaluation_answers"
  WHERE "score" IS NOT NULL
  GROUP BY "evaluationId"
) AS sub
WHERE e."id" = sub."evaluationId";
