-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthDate" DATE;

-- CreateEnum
CREATE TYPE "CaravanContactRole" AS ENUM ('DEPUTY', 'CLERIC', 'CULTURAL', 'SECURITY', 'RECEPTION');

-- CreateTable
CREATE TABLE "caravan_contacts" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "role" "CaravanContactRole" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caravan_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caravan_contacts_userId_idx" ON "caravan_contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "caravan_contacts_caravanId_role_key" ON "caravan_contacts"("caravanId", "role");

-- AddForeignKey
ALTER TABLE "caravan_contacts" ADD CONSTRAINT "caravan_contacts_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "caravans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caravan_contacts" ADD CONSTRAINT "caravan_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
