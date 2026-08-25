import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateEvaluationCampaignDto,
  FindEvaluationCampaignsQueryDto,
  UpdateEvaluationCampaignDto,
} from './dto/create-evaluation-campaign.dto';
import {
  CreateEvaluationQuestionDto,
  FindEvaluationQuestionsQueryDto,
  UpdateEvaluationQuestionDto,
} from './dto/create-evaluation-question.dto';
import {
  FindEvaluationPeopleQueryDto,
  FindEvaluationTargetsQueryDto,
  FindEvaluationsQueryDto,
  StartEvaluationDto,
  SubmitEvaluationDto,
} from './dto/evaluation-actions.dto';
import { EvaluationCampaignsService } from './evaluation-campaigns.service';
import { EvaluationQuestionsService } from './evaluation-questions.service';
import { EvaluationsService } from './evaluations.service';
import {
  EVALUATION_EVALUATOR_TYPES,
  EVALUATION_TARGET_TYPES,
} from './evaluation.constants';
import { EvaluationEvaluatorType, EvaluationTargetType } from '../generated/prisma/client';

type RequestUser = {
  id: string;
  roles?: { code: string }[];
  userRoles?: { role: { code: string } }[];
};

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(
    private readonly campaigns: EvaluationCampaignsService,
    private readonly questions: EvaluationQuestionsService,
    private readonly evaluations: EvaluationsService,
  ) {}

  // —— Campaigns (admin) ——
  @Get('evaluation-campaigns')
  @Roles('ADMIN')
  listCampaigns(@Query() query: FindEvaluationCampaignsQueryDto) {
    return this.campaigns.findAll(query);
  }

  @Get('evaluation-campaigns/active')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  activeCampaigns() {
    return this.campaigns.findActive();
  }

  @Get('evaluation-campaigns/:id')
  @Roles('ADMIN')
  getCampaign(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post('evaluation-campaigns')
  @Roles('ADMIN')
  createCampaign(@Body() dto: CreateEvaluationCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch('evaluation-campaigns/:id')
  @Roles('ADMIN')
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationCampaignDto,
  ) {
    return this.campaigns.update(id, dto);
  }

  @Delete('evaluation-campaigns/:id')
  @Roles('ADMIN')
  removeCampaign(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  // —— Questions (admin) ——
  @Get('evaluation-questions')
  @Roles('ADMIN')
  listQuestions(@Query() query: FindEvaluationQuestionsQueryDto) {
    return this.questions.findAll(query);
  }

  @Get('evaluation-questions/for-pair')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  questionsForPair(
    @Query('evaluatorType') evaluatorType: EvaluationEvaluatorType,
    @Query('targetType') targetType: EvaluationTargetType,
  ) {
    if (
      !EVALUATION_EVALUATOR_TYPES.includes(evaluatorType) ||
      !EVALUATION_TARGET_TYPES.includes(targetType)
    ) {
      return [];
    }
    return this.questions.findForPair(evaluatorType, targetType);
  }

  @Get('evaluation-questions/:id')
  @Roles('ADMIN')
  getQuestion(@Param('id') id: string) {
    return this.questions.findOne(id);
  }

  @Post('evaluation-questions')
  @Roles('ADMIN')
  createQuestion(@Body() dto: CreateEvaluationQuestionDto) {
    return this.questions.create(dto);
  }

  @Patch('evaluation-questions/:id')
  @Roles('ADMIN')
  updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationQuestionDto,
  ) {
    return this.questions.update(id, dto);
  }

  @Delete('evaluation-questions/:id')
  @Roles('ADMIN')
  removeQuestion(@Param('id') id: string) {
    return this.questions.remove(id);
  }

  // —— Evaluations ——
  @Get('evaluations')
  @Roles('ADMIN')
  listEvaluations(
    @Query() query: FindEvaluationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.evaluations.findAll(query, actor);
  }

  @Get('evaluations/mine')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  mine(@CurrentUser() actor: RequestUser) {
    return this.evaluations.findMine(actor);
  }

  @Get('evaluations/targets')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  targets(@Query() query: FindEvaluationTargetsQueryDto) {
    return this.evaluations.findTargets(query);
  }

  @Get('evaluations/people')
  @Roles('ADMIN')
  people(@Query() query: FindEvaluationPeopleQueryDto) {
    return this.evaluations.findPeople(query);
  }

  @Post('evaluations/start')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  start(@Body() dto: StartEvaluationDto, @CurrentUser() actor: RequestUser) {
    return this.evaluations.start(dto, actor);
  }

  @Get('evaluations/:id')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  getEvaluation(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.evaluations.findOne(id, actor);
  }

  @Post('evaluations/:id/submit')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitEvaluationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.evaluations.submit(id, dto, actor);
  }

  @Delete('evaluations/:id')
  @Roles('ADMIN')
  removeEvaluation(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.evaluations.remove(id, actor);
  }
}
