-- CreateEnum
CREATE TYPE "HonoraryServiceWeekDay" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateTable
CREATE TABLE "honorary_service_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "honorary_service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "honorary_service_announcements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceTypeId" TEXT,
    "otherDescription" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekDays" "HonoraryServiceWeekDay"[] DEFAULT ARRAY[]::"HonoraryServiceWeekDay"[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "honorary_service_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "honorary_service_types_name_idx" ON "honorary_service_types"("name");

-- CreateIndex
CREATE INDEX "honorary_service_types_createdAt_idx" ON "honorary_service_types"("createdAt");

-- CreateIndex
CREATE INDEX "honorary_service_announcements_userId_idx" ON "honorary_service_announcements"("userId");

-- CreateIndex
CREATE INDEX "honorary_service_announcements_serviceTypeId_idx" ON "honorary_service_announcements"("serviceTypeId");

-- CreateIndex
CREATE INDEX "honorary_service_announcements_startDate_idx" ON "honorary_service_announcements"("startDate");

-- CreateIndex
CREATE INDEX "honorary_service_announcements_endDate_idx" ON "honorary_service_announcements"("endDate");

-- CreateIndex
CREATE INDEX "honorary_service_announcements_createdAt_idx" ON "honorary_service_announcements"("createdAt");

-- AddForeignKey
ALTER TABLE "honorary_service_announcements" ADD CONSTRAINT "honorary_service_announcements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honorary_service_announcements" ADD CONSTRAINT "honorary_service_announcements_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "honorary_service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
