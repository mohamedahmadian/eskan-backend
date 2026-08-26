-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "requestsSimCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservations" ADD COLUMN "requestsBankCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservations" ADD COLUMN "specialServices" TEXT;
ALTER TABLE "reservations" ADD COLUMN "simCardNumber" TEXT;
ALTER TABLE "reservations" ADD COLUMN "simCardOperator" TEXT;
ALTER TABLE "reservations" ADD COLUMN "simCardDeliveredAt" DATE;
ALTER TABLE "reservations" ADD COLUMN "simCardInitialCharge" INTEGER;
ALTER TABLE "reservations" ADD COLUMN "bankCardNumber" TEXT;
ALTER TABLE "reservations" ADD COLUMN "bankCardIban" TEXT;
ALTER TABLE "reservations" ADD COLUMN "bankCardBank" TEXT;
ALTER TABLE "reservations" ADD COLUMN "bankCardDeliveredAt" DATE;
ALTER TABLE "reservations" ADD COLUMN "bankCardInitialBalance" INTEGER;
