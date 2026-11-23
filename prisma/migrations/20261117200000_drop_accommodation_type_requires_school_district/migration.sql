UPDATE "accommodations"
SET "schoolDistrictId" = NULL, "classroomCount" = NULL
WHERE "typeId" NOT IN (
  SELECT "id" FROM "accommodation_types" WHERE "code" = 'school'
);

-- AlterTable
ALTER TABLE "accommodation_types" DROP COLUMN "requiresSchoolDistrict";
