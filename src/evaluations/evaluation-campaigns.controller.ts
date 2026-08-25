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
import { EvaluationCampaignsService } from './evaluation-campaigns.service';

@Controller('evaluation-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationCampaignsController {
  constructor(private readonly campaigns: EvaluationCampaignsService) {}

  @Get('active')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  findActive() {
    return this.campaigns.findActive();
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: FindEvaluationCampaignsQueryDto) {
    return this.campaigns.findAll(query);
  }

  @Get(':id')
  @Roles(
    'ADMIN',
    'UNIT_MANAGER',
    'CARAVAN_MANAGER',
    'ACCOMMODATION_MANAGER',
    'PILGRIM',
  )
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEvaluationCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateEvaluationCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
