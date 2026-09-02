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
import { CreateCampaignParticipantDto } from './dto/create-participant.dto';
import { FindCampaignParticipantsQueryDto } from './dto/find-participants-query.dto';
import { UpdateCampaignParticipantDto } from './dto/update-participant.dto';
import { CampaignParticipantsService } from './participants.service';

@Controller('participation-campaigns/:campaignId/participants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CampaignParticipantsController {
  constructor(private readonly participants: CampaignParticipantsService) {}

  @Get()
  findAll(
    @Param('campaignId') campaignId: string,
    @Query() query: FindCampaignParticipantsQueryDto,
  ) {
    return this.participants.findAll(campaignId, query);
  }

  @Get(':id')
  findOne(
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
  ) {
    return this.participants.findOne(campaignId, id);
  }

  @Post()
  create(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCampaignParticipantDto,
  ) {
    return this.participants.create(campaignId, dto);
  }

  @Patch(':id')
  update(
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignParticipantDto,
  ) {
    return this.participants.update(campaignId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
  ) {
    return this.participants.remove(campaignId, id);
  }
}
