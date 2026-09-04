ALTER TABLE "benefactors" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "benefactors_code_key" ON "benefactors"("code");

INSERT INTO "benefactors" ("id", "firstName", "lastName", "name", "code", "createdAt", "updatedAt")
SELECT
  'a1b2c3d4-e5f6-4a44-8b44-000000000001',
  'ناشناس',
  '',
  'ناشناس',
  'ANONYMOUS',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "benefactors" WHERE "code" = 'ANONYMOUS'
);
