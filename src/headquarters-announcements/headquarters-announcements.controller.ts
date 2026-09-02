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
import { announcementAudiences } from './announcement-audiences';
import { CreateHeadquartersAnnouncementDto } from './dto/create-headquarters-announcement.dto';
import { FindHeadquartersAnnouncementsQueryDto } from './dto/find-headquarters-announcements-query.dto';
import { UpdateHeadquartersAnnouncementDto } from './dto/update-headquarters-announcement.dto';
import { HeadquartersAnnouncementsService } from './headquarters-announcements.service';

@Controller('headquarters-announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HeadquartersAnnouncementsController {
  constructor(
    private readonly headquartersAnnouncements: HeadquartersAnnouncementsService,
  ) {}

  @Get()
  findAll(@Query() query: FindHeadquartersAnnouncementsQueryDto) {
    return this.headquartersAnnouncements.findAll(query);
  }

  @Get('published')
  @Public()
  @Roles()
  findPublished(@Query('audience') audience?: string) {
    const selected = announcementAudiences.find((item) => item === audience);
    return this.headquartersAnnouncements.findPublished(selected);
  }

  @Get('published/:id')
  @Public()
  @Roles()
  findPublishedOne(@Param('id') id: string) {
    return this.headquartersAnnouncements.findPublishedOne(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.headquartersAnnouncements.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHeadquartersAnnouncementDto) {
    return this.headquartersAnnouncements.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHeadquartersAnnouncementDto,
  ) {
    return this.headquartersAnnouncements.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.headquartersAnnouncements.remove(id);
  }
}
