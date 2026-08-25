-- CreateEnum
CREATE TYPE "EvaluationEvaluatorType" AS ENUM ('UNIT_MANAGER', 'CARAVAN_MANAGER', 'ACCOMMODATION_MANAGER', 'PILGRIM');

-- CreateEnum
CREATE TYPE "EvaluationTargetType" AS ENUM ('CARAVAN_MANAGER', 'ACCOMMODATION_MANAGER', 'HEADQUARTERS');

-- CreateEnum
CREATE TYPE "EvaluationCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "evaluation_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATE NOT NULL,
    "endAt" DATE NOT NULL,
    "status" "EvaluationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_questions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evaluatorType" "EvaluationEvaluatorType" NOT NULL,
    "targetType" "EvaluationTargetType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorType" "EvaluationEvaluatorType" NOT NULL,
    "targetId" TEXT,
    "targetType" "EvaluationTargetType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_answers" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_campaigns_status_idx" ON "evaluation_campaigns"("status");

-- CreateIndex
CREATE INDEX "evaluation_campaigns_startAt_idx" ON "evaluation_campaigns"("startAt");

-- CreateIndex
CREATE INDEX "evaluation_campaigns_endAt_idx" ON "evaluation_campaigns"("endAt");

-- CreateIndex
CREATE INDEX "evaluation_campaigns_createdAt_idx" ON "evaluation_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "evaluation_questions_evaluatorType_targetType_isActive_sort_idx" ON "evaluation_questions"("evaluatorType", "targetType", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "evaluation_questions_createdAt_idx" ON "evaluation_questions"("createdAt");

-- CreateIndex
CREATE INDEX "evaluations_campaignId_idx" ON "evaluations"("campaignId");

-- CreateIndex
CREATE INDEX "evaluations_evaluatorId_evaluatorType_idx" ON "evaluations"("evaluatorId", "evaluatorType");

-- CreateIndex
CREATE INDEX "evaluations_targetId_targetType_idx" ON "evaluations"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "evaluations_status_idx" ON "evaluations"("status");

-- CreateIndex
CREATE INDEX "evaluations_createdAt_idx" ON "evaluations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_campaignId_evaluatorId_evaluatorType_targetType_key" ON "evaluations"("campaignId", "evaluatorId", "evaluatorType", "targetType", "targetKey");

-- CreateIndex
CREATE INDEX "evaluation_answers_questionId_idx" ON "evaluation_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_answers_evaluationId_questionId_key" ON "evaluation_answers"("evaluationId", "questionId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "evaluation_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_answers" ADD CONSTRAINT "evaluation_answers_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_answers" ADD CONSTRAINT "evaluation_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "evaluation_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
