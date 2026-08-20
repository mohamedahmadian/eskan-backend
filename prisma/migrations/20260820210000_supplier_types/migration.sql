-- CreateEnum
CREATE TYPE "SupplierType_new" AS ENUM (
  'GOVERNMENT_ORGANIZATION',
  'CHARITY',
  'COMPANY',
  'STORE',
  'MANUFACTURER',
  'WAREHOUSE',
  'SUPPLIER',
  'OTHER'
);

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "type" TYPE "SupplierType_new" USING (
  CASE "type"::text
    WHEN 'ORGANIZATION' THEN 'GOVERNMENT_ORGANIZATION'
    WHEN 'VENDOR' THEN 'STORE'
    WHEN 'OTHER' THEN 'OTHER'
    ELSE 'OTHER'
  END
)::"SupplierType_new";

DROP TYPE "SupplierType";
ALTER TYPE "SupplierType_new" RENAME TO "SupplierType";
