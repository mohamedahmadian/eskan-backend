-- DropTranslator
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_translatorId_fkey";
DROP INDEX IF EXISTS "reservations_translatorId_idx";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "translatorId";

-- CreateTable
CREATE TABLE "reservation_honorary_assignments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_honorary_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_honorary_assignments_reservationId_userId_serviceTypeId_key" ON "reservation_honorary_assignments"("reservationId", "userId", "serviceTypeId");

-- CreateIndex
CREATE INDEX "reservation_honorary_assignments_reservationId_idx" ON "reservation_honorary_assignments"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_honorary_assignments_userId_idx" ON "reservation_honorary_assignments"("userId");

-- CreateIndex
CREATE INDEX "reservation_honorary_assignments_serviceTypeId_idx" ON "reservation_honorary_assignments"("serviceTypeId");

-- CreateIndex
CREATE INDEX "reservation_honorary_assignments_assignedById_idx" ON "reservation_honorary_assignments"("assignedById");

-- CreateIndex
CREATE INDEX "reservation_honorary_assignments_createdAt_idx" ON "reservation_honorary_assignments"("createdAt");

-- AddForeignKey
ALTER TABLE "reservation_honorary_assignments" ADD CONSTRAINT "reservation_honorary_assignments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_honorary_assignments" ADD CONSTRAINT "reservation_honorary_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_honorary_assignments" ADD CONSTRAINT "reservation_honorary_assignments_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "honorary_service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_honorary_assignments" ADD CONSTRAINT "reservation_honorary_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
