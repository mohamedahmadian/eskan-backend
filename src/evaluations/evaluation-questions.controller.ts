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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  EvaluationEvaluatorType,
  EvaluationTargetType,
} from '../generated/prisma/client';
import {
  CreateEvaluationQuestionDto,
  FindEvaluationQuestionsQueryDto,
  UpdateEvaluationQuestionDto,
} from './dto/create-evaluation-question.dto';
import { EvaluationQuestionsService } from './evaluation-questions.service';

@Controller('evaluation-questions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationQuestionsController {
  constructor(private readonly questions: EvaluationQuestionsService) {}

  @Get('for-pair')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  findForPair(
    @Query('evaluatorType') evaluatorType: EvaluationEvaluatorType,
    @Query('targetType') targetType: EvaluationTargetType,
  ) {
    return this.questions.findForPair(evaluatorType, targetType);
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: FindEvaluationQuestionsQueryDto) {
    return this.questions.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.questions.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEvaluationQuestionDto) {
    return this.questions.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateEvaluationQuestionDto) {
    return this.questions.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.questions.remove(id);
  }
}
