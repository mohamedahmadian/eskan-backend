-- AlterTable
ALTER TABLE "walking_route_stages" ADD COLUMN "name" TEXT;
ALTER TABLE "walking_route_stages" ADD COLUMN "latitude" DECIMAL(10,7);
ALTER TABLE "walking_route_stages" ADD COLUMN "longitude" DECIMAL(10,7);
ALTER TABLE "walking_route_stages" ADD COLUMN "managerName" TEXT;
ALTER TABLE "walking_route_stages" ADD COLUMN "managerPhone" TEXT;
ALTER TABLE "walking_route_stages" ADD COLUMN "managerTelegram" TEXT;
ALTER TABLE "walking_route_stages" ADD COLUMN "managerWhatsapp" TEXT;
ALTER TABLE "walking_route_stages" ADD COLUMN "managerEitaa" TEXT;
