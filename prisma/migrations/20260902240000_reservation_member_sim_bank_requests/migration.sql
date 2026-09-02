-- AlterTable
ALTER TABLE "reservation_members" ADD COLUMN "requestsSimCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservation_members" ADD COLUMN "requestsBankCard" BOOLEAN NOT NULL DEFAULT false;
