CREATE TABLE "org_unit_translations" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_unit_translations_unitId_locale_key" ON "org_unit_translations"("unitId", "locale");

CREATE INDEX "org_unit_translations_locale_idx" ON "org_unit_translations"("locale");

CREATE INDEX "org_unit_translations_createdAt_idx" ON "org_unit_translations"("createdAt");

ALTER TABLE "org_unit_translations" ADD CONSTRAINT "org_unit_translations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
