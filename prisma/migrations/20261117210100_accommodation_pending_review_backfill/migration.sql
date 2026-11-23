-- Introduced listings that were never reviewed were stored as INACTIVE.
UPDATE "accommodations"
SET "status" = 'PENDING_REVIEW'
WHERE "status" = 'INACTIVE'
  AND "introducedById" IS NOT NULL
  AND "inspectionResult" IS NULL;
