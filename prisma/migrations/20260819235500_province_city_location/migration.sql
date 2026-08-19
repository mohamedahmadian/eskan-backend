-- AlterTable
ALTER TABLE "provinces" ADD COLUMN "neshanAddress" TEXT,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "cities" ADD COLUMN "neshanAddress" TEXT,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7);
