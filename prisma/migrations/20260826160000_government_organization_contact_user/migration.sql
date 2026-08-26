-- AlterTable
ALTER TABLE "government_organizations" ADD COLUMN "contactUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "government_organizations_contactUserId_key" ON "government_organizations"("contactUserId");

-- AddForeignKey
ALTER TABLE "government_organizations" ADD CONSTRAINT "government_organizations_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "government_organizations" DROP COLUMN "contactPerson";
