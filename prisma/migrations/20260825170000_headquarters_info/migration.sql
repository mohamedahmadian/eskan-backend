-- CreateTable
CREATE TABLE "headquarters_info" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "address" TEXT,
    "description" TEXT,
    "logoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headquarters_phones" (
    "id" TEXT NOT NULL,
    "headquartersId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headquarters_phones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "headquarters_info_name_idx" ON "headquarters_info"("name");

-- CreateIndex
CREATE INDEX "headquarters_info_createdAt_idx" ON "headquarters_info"("createdAt");

-- CreateIndex
CREATE INDEX "headquarters_phones_headquartersId_idx" ON "headquarters_phones"("headquartersId");

-- CreateIndex
CREATE INDEX "headquarters_phones_phone_idx" ON "headquarters_phones"("phone");

-- CreateIndex
CREATE INDEX "headquarters_phones_createdAt_idx" ON "headquarters_phones"("createdAt");

-- AddForeignKey
ALTER TABLE "headquarters_info" ADD CONSTRAINT "headquarters_info_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "headquarters_phones" ADD CONSTRAINT "headquarters_phones_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "headquarters_info"("id") ON DELETE CASCADE ON UPDATE CASCADE;
