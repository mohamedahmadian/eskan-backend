-- CreateTable
CREATE TABLE "caravan_license_images" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caravan_license_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caravan_license_images_caravanId_sortOrder_idx" ON "caravan_license_images"("caravanId", "sortOrder");

-- CreateIndex
CREATE INDEX "caravan_license_images_imageId_idx" ON "caravan_license_images"("imageId");

-- AddForeignKey
ALTER TABLE "caravan_license_images" ADD CONSTRAINT "caravan_license_images_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "caravans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caravan_license_images" ADD CONSTRAINT "caravan_license_images_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "stored_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single license images
INSERT INTO "caravan_license_images" ("id", "caravanId", "imageId", "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, "id", "licenseImageId", 0, CURRENT_TIMESTAMP
FROM "caravans"
WHERE "licenseImageId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "caravans" DROP CONSTRAINT "caravans_licenseImageId_fkey";

-- AlterTable
ALTER TABLE "caravans" DROP COLUMN "licenseImageId";
