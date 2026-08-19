-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('ISLAM', 'CHRISTIANITY', 'JUDAISM', 'ZOROASTRIANISM', 'OTHER');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "gender" "UserGender",
  ADD COLUMN "nationalId" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "religion" "Religion",
  ADD COLUMN "religionOther" TEXT,
  ADD COLUMN "telegram" TEXT,
  ADD COLUMN "bale" TEXT,
  ADD COLUMN "eitaa" TEXT,
  ADD COLUMN "whatsapp" TEXT,
  ADD COLUMN "otherSocial" TEXT,
  ADD COLUMN "vehiclePlates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "countryId" TEXT,
  ADD COLUMN "provinceId" TEXT,
  ADD COLUMN "cityId" TEXT,
  ADD COLUMN "photoId" TEXT,
  ADD COLUMN "nationalCardPhotoId" TEXT,
  ADD COLUMN "passportPhotoId" TEXT;

UPDATE "users"
SET
  "firstName" = CASE
    WHEN position(' ' in btrim("fullName")) > 0 THEN split_part(btrim("fullName"), ' ', 1)
    ELSE btrim("fullName")
  END,
  "lastName" = CASE
    WHEN position(' ' in btrim("fullName")) > 0 THEN btrim(substr(btrim("fullName"), position(' ' in btrim("fullName")) + 1))
    ELSE btrim("fullName")
  END
WHERE "firstName" IS NULL OR "lastName" IS NULL;

ALTER TABLE "users"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_nationalId_key" ON "users"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_fullName_idx" ON "users"("fullName");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_nationalCardPhotoId_fkey" FOREIGN KEY ("nationalCardPhotoId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_passportPhotoId_fkey" FOREIGN KEY ("passportPhotoId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable
DROP TABLE IF EXISTS "pilgrims";

-- DropEnum
DROP TYPE IF EXISTS "TravelType";
