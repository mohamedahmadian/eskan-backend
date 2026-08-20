UPDATE "item_quota_vouchers" SET "code" = '__tmp_quota__' || "id";

UPDATE "item_quota_vouchers" v
SET "code" = ranked.year::text || '-1-' || ranked.seq::text
FROM (
  SELECT
    v2.id,
    q.year,
    ROW_NUMBER() OVER (PARTITION BY q.year ORDER BY v2."issuedAt", v2.id) AS seq
  FROM "item_quota_vouchers" v2
  JOIN "item_quotas" q ON q.id = v2."quotaId"
) ranked
WHERE v.id = ranked.id;

UPDATE "ice_vouchers" SET "code" = '__tmp_ice__' || "id";

UPDATE "ice_vouchers" v
SET "code" = ranked.year::text || '-2-' || ranked.seq::text
FROM (
  SELECT
    id,
    year,
    ROW_NUMBER() OVER (PARTITION BY year ORDER BY "requestedAt", "createdAt", id) AS seq
  FROM "ice_vouchers"
) ranked
WHERE v.id = ranked.id;
