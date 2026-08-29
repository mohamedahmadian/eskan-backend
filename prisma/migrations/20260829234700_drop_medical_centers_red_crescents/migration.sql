-- DropForeignKey
ALTER TABLE "medical_centers" DROP CONSTRAINT "medical_centers_cityId_fkey";

-- DropForeignKey
ALTER TABLE "medical_centers" DROP CONSTRAINT "medical_centers_provinceId_fkey";

-- DropForeignKey
ALTER TABLE "red_crescents" DROP CONSTRAINT "red_crescents_cityId_fkey";

-- DropForeignKey
ALTER TABLE "red_crescents" DROP CONSTRAINT "red_crescents_provinceId_fkey";

-- DropTable
DROP TABLE "medical_centers";

-- DropTable
DROP TABLE "red_crescents";
