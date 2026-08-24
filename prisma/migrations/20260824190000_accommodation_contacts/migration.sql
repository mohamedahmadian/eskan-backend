-- CreateEnum
CREATE TYPE "AccommodationContactRole" AS ENUM (
  'DEPUTY',
  'RECEPTION',
  'FACILITIES_SAFETY',
  'SECURITY',
  'HEALTH',
  'CULTURAL',
  'LOGISTICS_SUPPORT'
);

-- CreateTable
CREATE TABLE "accommodation_contacts" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "role" "AccommodationContactRole" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_year_contacts" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "role" "AccommodationContactRole" NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_year_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accommodation_contacts_userId_idx" ON "accommodation_contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_contacts_accommodationId_role_key" ON "accommodation_contacts"("accommodationId", "role");

-- CreateIndex
CREATE INDEX "accommodation_year_contacts_userId_idx" ON "accommodation_year_contacts"("userId");

-- CreateIndex
CREATE INDEX "accommodation_year_contacts_accommodationId_year_idx" ON "accommodation_year_contacts"("accommodationId", "year");

-- CreateIndex
CREATE INDEX "accommodation_year_contacts_year_idx" ON "accommodation_year_contacts"("year");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_year_contacts_accommodationId_role_year_key" ON "accommodation_year_contacts"("accommodationId", "role", "year");

-- AddForeignKey
ALTER TABLE "accommodation_contacts" ADD CONSTRAINT "accommodation_contacts_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_contacts" ADD CONSTRAINT "accommodation_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_year_contacts" ADD CONSTRAINT "accommodation_year_contacts_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_year_contacts" ADD CONSTRAINT "accommodation_year_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
