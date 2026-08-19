-- AlterTable
ALTER TABLE "provinces" ADD COLUMN "representativeId" TEXT;

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "representativeId" TEXT;

-- CreateIndex
CREATE INDEX "provinces_representativeId_idx" ON "provinces"("representativeId");

-- CreateIndex
CREATE INDEX "cities_representativeId_idx" ON "cities"("representativeId");

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
