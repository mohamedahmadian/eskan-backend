CREATE TABLE "headquarters_info_translations" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_info_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "headquarters_info_translations_headquartersId_locale_key" ON "headquarters_info_translations"("headquartersId", "locale");

CREATE INDEX "headquarters_info_translations_locale_idx" ON "headquarters_info_translations"("locale");

CREATE INDEX "headquarters_info_translations_createdAt_idx" ON "headquarters_info_translations"("createdAt");

ALTER TABLE "headquarters_info_translations" ADD CONSTRAINT "headquarters_info_translations_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "headquarters_info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
