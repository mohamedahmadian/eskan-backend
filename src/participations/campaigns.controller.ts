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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ParticipationCampaignsService } from './campaigns.service';
import { CreateParticipationCampaignDto } from './dto/create-campaign.dto';
import { FindParticipationCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import { UpdateParticipationCampaignDto } from './dto/update-campaign.dto';

@Controller('participation-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ParticipationCampaignsController {
  constructor(private readonly campaigns: ParticipationCampaignsService) {}

  @Get('showcase')
  showcase() {
    return this.campaigns.showcase();
  }

  @Get('public')
  @Public()
  @Roles()
  showcasePublic() {
    return this.campaigns.showcasePublic();
  }

  @Get('public/:id')
  @Public()
  @Roles()
  findPublicOne(@Param('id') id: string) {
    return this.campaigns.findPublicOne(id);
  }

  @Get()
  findAll(@Query() query: FindParticipationCampaignsQueryDto) {
    return this.campaigns.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateParticipationCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateParticipationCampaignDto,
  ) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
