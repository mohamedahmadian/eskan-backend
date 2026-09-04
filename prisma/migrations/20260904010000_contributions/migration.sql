-- AlterTable
ALTER TABLE "benefactors" ADD COLUMN "firstName" TEXT;
ALTER TABLE "benefactors" ADD COLUMN "lastName" TEXT;
ALTER TABLE "benefactors" ADD COLUMN "nationalId" TEXT;

UPDATE "benefactors"
SET
  "firstName" = CASE
    WHEN position(' ' in trim("name")) > 0 THEN left(trim("name"), position(' ' in trim("name")) - 1)
    ELSE trim("name")
  END,
  "lastName" = CASE
    WHEN position(' ' in trim("name")) > 0 THEN trim(substring(trim("name") from position(' ' in trim("name")) + 1))
    ELSE ''
  END;

ALTER TABLE "benefactors" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "benefactors" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "benefactors" ALTER COLUMN "provinceId" DROP NOT NULL;
ALTER TABLE "benefactors" ALTER COLUMN "cityId" DROP NOT NULL;

CREATE INDEX "benefactors_firstName_idx" ON "benefactors"("firstName");
CREATE INDEX "benefactors_lastName_idx" ON "benefactors"("lastName");
CREATE INDEX "benefactors_nationalId_idx" ON "benefactors"("nationalId");

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('CASH', 'IN_KIND');

-- CreateTable
CREATE TABLE "goods_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_goods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_goods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "benefactorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" DECIMAL(12,3),
    "goodsId" TEXT,
    "unitId" TEXT,
    "campaignId" TEXT,
    "trackingCode" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goods_units_name_key" ON "goods_units"("name");
CREATE INDEX "goods_units_isActive_idx" ON "goods_units"("isActive");
CREATE UNIQUE INDEX "contribution_goods_name_key" ON "contribution_goods"("name");
CREATE INDEX "contribution_goods_isActive_idx" ON "contribution_goods"("isActive");
CREATE INDEX "contributions_type_idx" ON "contributions"("type");
CREATE INDEX "contributions_benefactorId_idx" ON "contributions"("benefactorId");
CREATE INDEX "contributions_goodsId_idx" ON "contributions"("goodsId");
CREATE INDEX "contributions_unitId_idx" ON "contributions"("unitId");
CREATE INDEX "contributions_campaignId_idx" ON "contributions"("campaignId");
CREATE INDEX "contributions_trackingCode_idx" ON "contributions"("trackingCode");
CREATE INDEX "contributions_createdAt_idx" ON "contributions"("createdAt");

ALTER TABLE "contributions" ADD CONSTRAINT "contributions_benefactorId_fkey" FOREIGN KEY ("benefactorId") REFERENCES "benefactors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_goodsId_fkey" FOREIGN KEY ("goodsId") REFERENCES "contribution_goods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "goods_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "participation_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
