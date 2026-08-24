-- CreateTable
CREATE TABLE "government_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "mobile" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "government_organizations_name_idx" ON "government_organizations"("name");

-- CreateIndex
CREATE INDEX "government_organizations_createdAt_idx" ON "government_organizations"("createdAt");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "issuingOrganizationId" TEXT;

-- CreateIndex
CREATE INDEX "users_issuingOrganizationId_idx" ON "users"("issuingOrganizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_issuingOrganizationId_fkey" FOREIGN KEY ("issuingOrganizationId") REFERENCES "government_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
