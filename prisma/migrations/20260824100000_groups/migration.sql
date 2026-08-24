-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "eitaa" TEXT,
    "bale" TEXT,
    "telegram" TEXT,
    "instagram" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_cityId_idx" ON "groups"("cityId");
CREATE INDEX "groups_managerUserId_idx" ON "groups"("managerUserId");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
