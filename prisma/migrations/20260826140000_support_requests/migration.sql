-- CreateEnum
CREATE TYPE "SupportRequestType" AS ENUM ('GOODS', 'PLACE', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "SupportRequestType" NOT NULL,
    "subject" TEXT NOT NULL,
    "quantity" INTEGER,
    "requestedAt" DATE NOT NULL,
    "neededBy" DATE,
    "description" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'PENDING',
    "handlingOrganizationId" TEXT,
    "handledAt" DATE,
    "handlingNotes" TEXT,
    "requestedById" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_organizationId_idx" ON "support_requests"("organizationId");

-- CreateIndex
CREATE INDEX "support_requests_handlingOrganizationId_idx" ON "support_requests"("handlingOrganizationId");

-- CreateIndex
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");

-- CreateIndex
CREATE INDEX "support_requests_type_idx" ON "support_requests"("type");

-- CreateIndex
CREATE INDEX "support_requests_requestedAt_idx" ON "support_requests"("requestedAt");

-- CreateIndex
CREATE INDEX "support_requests_createdAt_idx" ON "support_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "government_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_handlingOrganizationId_fkey" FOREIGN KEY ("handlingOrganizationId") REFERENCES "government_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
