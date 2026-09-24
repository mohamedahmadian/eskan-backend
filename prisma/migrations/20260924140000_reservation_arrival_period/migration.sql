-- CreateEnum
CREATE TYPE "ReservationArrivalPeriod" AS ENUM ('BEFORE_NOON', 'AFTER_NOON');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "arrivalPeriod" "ReservationArrivalPeriod";
