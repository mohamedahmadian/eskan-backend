-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('INDIVIDUAL', 'GROUP', 'CARAVAN');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM (
  'DRAFT',
  'PENDING_MANAGEMENT_REVIEW',
  'COMPANIONS',
  'CARAVAN_CONTACTS',
  'INSURANCE',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "ReservationMemberInsuranceStatus" AS ENUM ('PENDING', 'PAID', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "ReservationType" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'DRAFT',
    "travelDate" DATE NOT NULL,
    "originCityId" TEXT NOT NULL,
    "walkingRouteId" TEXT,
    "stayStartDate" DATE NOT NULL,
    "stayEndDate" DATE NOT NULL,
    "walkingStartDate" DATE,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "caravanId" TEXT,
    "caravanManagerId" TEXT,
    "managementNotes" TEXT,
    "caravanManagerNotes" TEXT,
    "basicInfoLockedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "returnedToStatus" "ReservationStatus",
    "basicInfoCompletedAt" TIMESTAMP(3),
    "basicInfoCompletedById" TEXT,
    "managementReviewedAt" TIMESTAMP(3),
    "managementReviewedById" TEXT,
    "companionsCompletedAt" TIMESTAMP(3),
    "companionsCompletedById" TEXT,
    "caravanContactsCompletedAt" TIMESTAMP(3),
    "caravanContactsCompletedById" TEXT,
    "insuranceCompletedAt" TIMESTAMP(3),
    "insuranceCompletedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_members" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insuranceStatus" "ReservationMemberInsuranceStatus" NOT NULL DEFAULT 'PENDING',
    "insurancePaidAt" TIMESTAMP(3),
    "insurancePaymentRef" TEXT,
    "insuranceManualNote" TEXT,
    "insuranceVerifiedAt" TIMESTAMP(3),
    "insuranceVerifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_caravan_contacts" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "role" "CaravanContactRole" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_caravan_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception_settings" (
    "year" INTEGER NOT NULL,
    "individualEnabled" BOOLEAN NOT NULL DEFAULT false,
    "individualMaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "individualFemaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "individualAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "groupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "groupMaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "groupFemaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "groupAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "caravanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "caravanMaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "caravanFemaleCapacity" INTEGER NOT NULL DEFAULT 0,
    "caravanAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reception_settings_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "reservations_createdById_idx" ON "reservations"("createdById");

-- CreateIndex
CREATE INDEX "reservations_year_idx" ON "reservations"("year");

-- CreateIndex
CREATE INDEX "reservations_type_idx" ON "reservations"("type");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_year_type_status_idx" ON "reservations"("year", "type", "status");

-- CreateIndex
CREATE INDEX "reservations_caravanId_idx" ON "reservations"("caravanId");

-- CreateIndex
CREATE INDEX "reservations_caravanManagerId_idx" ON "reservations"("caravanManagerId");

-- CreateIndex
CREATE INDEX "reservations_walkingRouteId_idx" ON "reservations"("walkingRouteId");

-- CreateIndex
CREATE INDEX "reservations_originCityId_idx" ON "reservations"("originCityId");

-- CreateIndex
CREATE INDEX "reservation_members_reservationId_idx" ON "reservation_members"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_members_userId_idx" ON "reservation_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_members_reservationId_userId_key" ON "reservation_members"("reservationId", "userId");

-- CreateIndex
CREATE INDEX "reservation_caravan_contacts_reservationId_idx" ON "reservation_caravan_contacts"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_caravan_contacts_userId_idx" ON "reservation_caravan_contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_caravan_contacts_reservationId_role_key" ON "reservation_caravan_contacts"("reservationId", "role");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_originCityId_fkey" FOREIGN KEY ("originCityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_walkingRouteId_fkey" FOREIGN KEY ("walkingRouteId") REFERENCES "walking_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "caravans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_caravanManagerId_fkey" FOREIGN KEY ("caravanManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_basicInfoCompletedById_fkey" FOREIGN KEY ("basicInfoCompletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_managementReviewedById_fkey" FOREIGN KEY ("managementReviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_companionsCompletedById_fkey" FOREIGN KEY ("companionsCompletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_caravanContactsCompletedById_fkey" FOREIGN KEY ("caravanContactsCompletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_insuranceCompletedById_fkey" FOREIGN KEY ("insuranceCompletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_members" ADD CONSTRAINT "reservation_members_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_members" ADD CONSTRAINT "reservation_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_members" ADD CONSTRAINT "reservation_members_insuranceVerifiedById_fkey" FOREIGN KEY ("insuranceVerifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_caravan_contacts" ADD CONSTRAINT "reservation_caravan_contacts_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_caravan_contacts" ADD CONSTRAINT "reservation_caravan_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
