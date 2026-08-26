-- CreateEnum
CREATE TYPE "EvaluationAnswerType" AS ENUM ('FIVE_SCALE', 'TEXT', 'YES_NO');

-- AlterTable
ALTER TABLE "evaluation_questions" ADD COLUMN "answerType" "EvaluationAnswerType" NOT NULL DEFAULT 'FIVE_SCALE';

-- AlterTable
ALTER TABLE "evaluation_answers" ALTER COLUMN "score" DROP NOT NULL,
ADD COLUMN "yesNo" BOOLEAN,
ADD COLUMN "textValue" TEXT;

-- CreateIndex
CREATE INDEX "evaluation_questions_answerType_idx" ON "evaluation_questions"("answerType");
