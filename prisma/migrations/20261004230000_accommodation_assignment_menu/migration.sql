UPDATE "menus" SET "sortOrder" = 7 WHERE "code" = 'accommodation.year-management';
UPDATE "menus" SET "sortOrder" = 8 WHERE "code" = 'accommodation.report';

INSERT INTO "menus" ("id", "moduleId", "code", "nameKey", "path", "icon", "sortOrder")
SELECT gen_random_uuid()::text, m."id", 'accommodation.assignment', 'menus.accommodationAssignment', '/accommodation-assignments', 'user-round-plus', 6
FROM "nav_modules" m
WHERE m."code" = 'accommodation'
  AND NOT EXISTS (SELECT 1 FROM "menus" WHERE "code" = 'accommodation.assignment');

INSERT INTO "role_menus" ("roleId", "menuId")
SELECT r."id", m."id"
FROM "roles" r
CROSS JOIN "menus" m
WHERE m."code" = 'accommodation.assignment'
  AND r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menus" rm
    WHERE rm."roleId" = r."id" AND rm."menuId" = m."id"
  );
