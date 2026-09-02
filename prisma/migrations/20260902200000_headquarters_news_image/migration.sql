ALTER TABLE "headquarters_news" ADD COLUMN "imageId" TEXT;

ALTER TABLE "headquarters_news" ADD CONSTRAINT "headquarters_news_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
