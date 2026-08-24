-- CreateTable
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "description" TEXT,
    "managerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_accommodation_liaisons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_accommodation_liaisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_caravan_liaisons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_caravan_liaisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_units_name_idx" ON "org_units"("name");

-- CreateIndex
CREATE INDEX "org_units_managerUserId_idx" ON "org_units"("managerUserId");

-- CreateIndex
CREATE INDEX "org_units_createdAt_idx" ON "org_units"("createdAt");

-- CreateIndex
CREATE INDEX "org_unit_accommodation_liaisons_userId_idx" ON "org_unit_accommodation_liaisons"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_accommodation_liaisons_unitId_userId_key" ON "org_unit_accommodation_liaisons"("unitId", "userId");

-- CreateIndex
CREATE INDEX "org_unit_caravan_liaisons_userId_idx" ON "org_unit_caravan_liaisons"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_caravan_liaisons_unitId_userId_key" ON "org_unit_caravan_liaisons"("unitId", "userId");

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_accommodation_liaisons" ADD CONSTRAINT "org_unit_accommodation_liaisons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_accommodation_liaisons" ADD CONSTRAINT "org_unit_accommodation_liaisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_caravan_liaisons" ADD CONSTRAINT "org_unit_caravan_liaisons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_caravan_liaisons" ADD CONSTRAINT "org_unit_caravan_liaisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
