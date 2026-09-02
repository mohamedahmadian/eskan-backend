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
import { CreateHeadquartersNewsDto } from './dto/create-headquarters-news.dto';
import { FindHeadquartersNewsQueryDto } from './dto/find-headquarters-news-query.dto';
import { UpdateHeadquartersNewsDto } from './dto/update-headquarters-news.dto';
import { HeadquartersNewsService } from './headquarters-news.service';

@Controller('headquarters-news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HeadquartersNewsController {
  constructor(private readonly headquartersNews: HeadquartersNewsService) {}

  @Get()
  findAll(@Query() query: FindHeadquartersNewsQueryDto) {
    return this.headquartersNews.findAll(query);
  }

  @Get('published')
  @Public()
  @Roles()
  findPublished() {
    return this.headquartersNews.findPublished();
  }

  @Get('published/:id')
  @Public()
  @Roles()
  findPublishedOne(@Param('id') id: string) {
    return this.headquartersNews.findPublishedOne(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.headquartersNews.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHeadquartersNewsDto) {
    return this.headquartersNews.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHeadquartersNewsDto) {
    return this.headquartersNews.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.headquartersNews.remove(id);
  }
}
