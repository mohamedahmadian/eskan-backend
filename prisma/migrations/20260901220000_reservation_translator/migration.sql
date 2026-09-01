-- AlterTable
ALTER TABLE "honorary_service_types" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "honorary_service_types_code_key" ON "honorary_service_types"("code");

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "translatorId" TEXT;

-- CreateIndex
CREATE INDEX "reservations_translatorId_idx" ON "reservations"("translatorId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed translation service type (idempotent)
UPDATE "honorary_service_types"
SET "code" = 'TRANSLATION'
WHERE "name" = 'مترجمی' AND "code" IS NULL;

INSERT INTO "honorary_service_types" ("id", "name", "description", "code", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'مترجمی', 'ترجمه و همراهی زبانی زائران عراقی و بین‌المللی', 'TRANSLATION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "honorary_service_types" WHERE "code" = 'TRANSLATION' OR "name" = 'مترجمی'
);

-- Translator pilgrimage-files menu under honorary-servants
INSERT INTO "menus" ("id", "moduleId", "code", "nameKey", "path", "icon", "sortOrder")
SELECT gen_random_uuid()::text, m."id", 'reservations.translator', 'menus.translatorReservations', '/translator-reservations', 'languages', 0
FROM "nav_modules" m
WHERE m."code" = 'honorary-servants'
  AND NOT EXISTS (SELECT 1 FROM "menus" WHERE "code" = 'reservations.translator');

INSERT INTO "role_menus" ("roleId", "menuId")
SELECT r."id", m."id"
FROM "roles" r
CROSS JOIN "menus" m
WHERE r."code" = 'HONORARY_SERVANT'
  AND m."code" = 'reservations.translator'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menus" rm
    WHERE rm."roleId" = r."id" AND rm."menuId" = m."id"
  );
