ALTER TABLE "accommodations" ADD COLUMN "introducedById" TEXT;

CREATE INDEX "accommodations_introducedById_idx" ON "accommodations"("introducedById");

ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_introducedById_fkey" FOREIGN KEY ("introducedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "menus" SET "sortOrder" = 1 WHERE "code" = 'accommodation.list';
UPDATE "menus" SET "sortOrder" = 2 WHERE "code" = 'accommodation.mine';
UPDATE "menus" SET "sortOrder" = 3 WHERE "code" = 'accommodation.introduce';
UPDATE "menus" SET "sortOrder" = 5 WHERE "code" = 'accommodation.managers';
UPDATE "menus" SET "sortOrder" = 6 WHERE "code" = 'accommodation.year-management';
UPDATE "menus" SET "sortOrder" = 7 WHERE "code" = 'accommodation.report';

INSERT INTO "menus" ("id", "moduleId", "code", "nameKey", "path", "icon", "sortOrder")
SELECT gen_random_uuid()::text, m."id", 'accommodation.introduced', 'menus.introducedAccommodations', '/introduced-accommodations', 'file-check', 4
FROM "nav_modules" m
WHERE m."code" = 'accommodation'
  AND NOT EXISTS (SELECT 1 FROM "menus" WHERE "code" = 'accommodation.introduced');

INSERT INTO "role_menus" ("roleId", "menuId")
SELECT r."id", m."id"
FROM "roles" r
CROSS JOIN "menus" m
WHERE m."code" = 'accommodation.introduced'
  AND r."code" IN (
    'ACCOMMODATION_MANAGER',
    'CARAVAN_MANAGER',
    'GROUP_MANAGER',
    'PILGRIM',
    'HEADQUARTERS_REPRESENTATIVE',
    'LICENSE_ISSUER',
    'UNIT_MANAGER',
    'GOVERNMENT_ORG_OFFICER',
    'HONORARY_SERVANT',
    'STATION_MANAGER'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "role_menus" rm
    WHERE rm."roleId" = r."id" AND rm."menuId" = m."id"
  );
