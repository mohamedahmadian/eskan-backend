CREATE TABLE "headquarters_announcement_translations" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_announcement_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hq_announcement_tr_announcementId_locale_key" ON "headquarters_announcement_translations"("announcementId", "locale");

CREATE INDEX "headquarters_announcement_translations_locale_idx" ON "headquarters_announcement_translations"("locale");

CREATE INDEX "headquarters_announcement_translations_createdAt_idx" ON "headquarters_announcement_translations"("createdAt");

ALTER TABLE "headquarters_announcement_translations" ADD CONSTRAINT "headquarters_announcement_translations_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "headquarters_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "participation_campaign_translations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participation_campaign_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "participation_campaign_translations_campaignId_locale_key" ON "participation_campaign_translations"("campaignId", "locale");

CREATE INDEX "participation_campaign_translations_locale_idx" ON "participation_campaign_translations"("locale");

CREATE INDEX "participation_campaign_translations_createdAt_idx" ON "participation_campaign_translations"("createdAt");

ALTER TABLE "participation_campaign_translations" ADD CONSTRAINT "participation_campaign_translations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "participation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
