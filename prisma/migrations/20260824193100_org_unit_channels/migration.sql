-- AlterTable
ALTER TABLE "org_units" ADD COLUMN IF NOT EXISTS "eitaaChannel" TEXT;
ALTER TABLE "org_units" ADD COLUMN IF NOT EXISTS "telegramChannel" TEXT;
