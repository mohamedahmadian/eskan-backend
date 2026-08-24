-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "reservations_groupId_idx" ON "reservations"("groupId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
