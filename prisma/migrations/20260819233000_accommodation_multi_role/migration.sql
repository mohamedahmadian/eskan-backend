-- CreateEnum
CREATE TYPE "AccommodationType" AS ENUM ('SCHOOL', 'MOSQUE', 'HUSSEINIEH', 'HALL', 'HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "AccommodationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FULL');

-- CreateEnum
CREATE TYPE "GenderType" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- Migrate existing single roles
INSERT INTO "user_roles" ("userId", "roleId")
SELECT "id", "roleId" FROM "users";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_roleId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "roleId";

-- CreateTable
CREATE TABLE "accommodations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccommodationType" NOT NULL,
    "status" "AccommodationStatus" NOT NULL DEFAULT 'ACTIVE',
    "genderType" "GenderType" NOT NULL,
    "maleCapacity" INTEGER NOT NULL DEFAULT 0,
    "femaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "assignedMaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "assignedFemaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "address" TEXT,
    "neshanAddress" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "eitaa" TEXT,
    "bale" TEXT,
    "otherSocial" TEXT,
    "description" TEXT,
    "countryId" TEXT,
    "provinceId" TEXT,
    "cityId" TEXT,
    "distanceToShrineKm" DECIMAL(8,2),
    "distanceToMashhadKm" DECIMAL(8,2),
    "hasLaundry" BOOLEAN NOT NULL DEFAULT false,
    "hasInternet" BOOLEAN NOT NULL DEFAULT false,
    "hasPrayerRoom" BOOLEAN NOT NULL DEFAULT false,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "heatingSystem" TEXT,
    "coolingSystem" TEXT,
    "parkingCapacity" INTEGER,
    "bathroomCount" INTEGER,
    "toiletCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_managers" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accommodation_managers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accommodations_name_idx" ON "accommodations"("name");

-- CreateIndex
CREATE INDEX "accommodations_status_type_idx" ON "accommodations"("status", "type");

-- CreateIndex
CREATE INDEX "accommodations_cityId_idx" ON "accommodations"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_managers_accommodationId_userId_key" ON "accommodation_managers"("accommodationId", "userId");

-- CreateIndex
CREATE INDEX "accommodation_managers_userId_idx" ON "accommodation_managers"("userId");

-- One primary accommodation per manager
CREATE UNIQUE INDEX "accommodation_managers_user_primary_key" ON "accommodation_managers"("userId") WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_managers" ADD CONSTRAINT "accommodation_managers_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_managers" ADD CONSTRAINT "accommodation_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
