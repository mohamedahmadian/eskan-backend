-- CreateTable
CREATE TABLE "accommodation_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'building-2',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresSchoolDistrict" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_types_code_key" ON "accommodation_types"("code");

-- CreateIndex
CREATE INDEX "accommodation_types_isActive_sortOrder_idx" ON "accommodation_types"("isActive", "sortOrder");

INSERT INTO "accommodation_types" ("id", "code", "nameFa", "nameEn", "icon", "isActive", "sortOrder", "requiresSchoolDistrict", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'school', 'مدرسه', 'School', 'school', true, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'mosque', 'مسجد', 'Mosque', 'landmark', true, 2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'husseinieh', 'حسینیه', 'Husseiniyeh', 'building', true, 3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'hall', 'سالن', 'Hall', 'building-2', true, 4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'house', 'منزل', 'House', 'home', true, 5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'other', 'سایر', 'Other', 'map-pin', true, 6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "accommodations" ADD COLUMN "typeId" TEXT;

UPDATE "accommodations" AS a
SET "typeId" = t."id"
FROM "accommodation_types" AS t
WHERE lower(a."type"::text) = t."code";

UPDATE "accommodations" AS a
SET "typeId" = t."id"
FROM "accommodation_types" AS t
WHERE a."typeId" IS NULL
  AND t."code" = 'other';

ALTER TABLE "accommodations" ALTER COLUMN "typeId" SET NOT NULL;

DROP INDEX "accommodations_status_type_idx";

ALTER TABLE "accommodations" DROP COLUMN "type";

DROP TYPE "AccommodationType";

CREATE INDEX "accommodations_status_typeId_idx" ON "accommodations"("status", "typeId");

CREATE INDEX "accommodations_typeId_idx" ON "accommodations"("typeId");

ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "accommodation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
