-- CreateTable
CREATE TABLE "school_districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_districts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_districts_name_idx" ON "school_districts"("name");

-- AlterTable
ALTER TABLE "accommodations" ADD COLUMN "classroomCount" INTEGER;
ALTER TABLE "accommodations" ADD COLUMN "schoolDistrictId" TEXT;

-- CreateIndex
CREATE INDEX "accommodations_schoolDistrictId_idx" ON "accommodations"("schoolDistrictId");

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_schoolDistrictId_fkey" FOREIGN KEY ("schoolDistrictId") REFERENCES "school_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "menus" ("id", "moduleId", "code", "nameKey", "path", "icon", "sortOrder")
SELECT gen_random_uuid()::text, m."id", 'accommodation.base-info', 'menus.accommodationBaseInfo', '/accommodation-base-info', 'database', 9
FROM "nav_modules" m
WHERE m."code" = 'accommodation'
  AND NOT EXISTS (SELECT 1 FROM "menus" WHERE "code" = 'accommodation.base-info');

INSERT INTO "role_menus" ("roleId", "menuId")
SELECT r."id", m."id"
FROM "roles" r
CROSS JOIN "menus" m
WHERE m."code" = 'accommodation.base-info'
  AND r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "role_menus" rm
    WHERE rm."roleId" = r."id" AND rm."menuId" = m."id"
  );
