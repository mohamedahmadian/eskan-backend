ALTER TABLE "contributions" ADD COLUMN "shareCount" INTEGER;

CREATE INDEX "contributions_shareCount_idx" ON "contributions"("shareCount");

DROP TABLE IF EXISTS "campaign_participants";
