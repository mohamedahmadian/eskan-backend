import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvaluationCampaignsService } from './evaluation-campaigns.service';
import { EvaluationQuestionsService } from './evaluation-questions.service';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [AuthModule],
  controllers: [EvaluationsController],
  providers: [
    EvaluationCampaignsService,
    EvaluationQuestionsService,
    EvaluationsService,
  ],
})
export class EvaluationsModule {}
