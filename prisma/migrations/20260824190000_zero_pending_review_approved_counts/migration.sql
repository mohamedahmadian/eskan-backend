UPDATE "reservations"
SET "maleCount" = 0,
    "femaleCount" = 0,
    "totalCount" = 0
WHERE "status" = 'PENDING_MANAGEMENT_REVIEW';
