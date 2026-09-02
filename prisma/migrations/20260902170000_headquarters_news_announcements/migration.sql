-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('PILGRIMS', 'CARAVAN_MANAGERS', 'ACCOMMODATION_MANAGERS');

-- CreateTable
CREATE TABLE "headquarters_news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "publishedAt" DATE NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headquarters_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL,
    "publishedAt" DATE NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "headquarters_news_title_idx" ON "headquarters_news"("title");

-- CreateIndex
CREATE INDEX "headquarters_news_publishedAt_idx" ON "headquarters_news"("publishedAt");

-- CreateIndex
CREATE INDEX "headquarters_news_isPublished_idx" ON "headquarters_news"("isPublished");

-- CreateIndex
CREATE INDEX "headquarters_news_createdAt_idx" ON "headquarters_news"("createdAt");

-- CreateIndex
CREATE INDEX "headquarters_announcements_title_idx" ON "headquarters_announcements"("title");

-- CreateIndex
CREATE INDEX "headquarters_announcements_audience_idx" ON "headquarters_announcements"("audience");

-- CreateIndex
CREATE INDEX "headquarters_announcements_publishedAt_idx" ON "headquarters_announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "headquarters_announcements_isPublished_idx" ON "headquarters_announcements"("isPublished");

-- CreateIndex
CREATE INDEX "headquarters_announcements_createdAt_idx" ON "headquarters_announcements"("createdAt");
