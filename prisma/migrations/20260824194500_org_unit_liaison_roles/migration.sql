-- CreateTable
CREATE TABLE "org_unit_accommodation_liaisons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" "AccommodationContactRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_accommodation_liaisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_caravan_liaisons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" "CaravanContactRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_caravan_liaisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_unit_accommodation_liaisons_role_idx" ON "org_unit_accommodation_liaisons"("role");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_accommodation_liaisons_unitId_role_key" ON "org_unit_accommodation_liaisons"("unitId", "role");

-- CreateIndex
CREATE INDEX "org_unit_caravan_liaisons_role_idx" ON "org_unit_caravan_liaisons"("role");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_caravan_liaisons_unitId_role_key" ON "org_unit_caravan_liaisons"("unitId", "role");

-- AddForeignKey
ALTER TABLE "org_unit_accommodation_liaisons" ADD CONSTRAINT "org_unit_accommodation_liaisons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_caravan_liaisons" ADD CONSTRAINT "org_unit_caravan_liaisons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
