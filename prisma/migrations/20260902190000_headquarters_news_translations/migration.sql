CREATE TABLE "headquarters_news_translations" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_news_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "headquarters_news_translations_newsId_locale_key" ON "headquarters_news_translations"("newsId", "locale");

CREATE INDEX "headquarters_news_translations_locale_idx" ON "headquarters_news_translations"("locale");

CREATE INDEX "headquarters_news_translations_createdAt_idx" ON "headquarters_news_translations"("createdAt");

ALTER TABLE "headquarters_news_translations" ADD CONSTRAINT "headquarters_news_translations_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "headquarters_news"("id") ON DELETE CASCADE ON UPDATE CASCADE;
