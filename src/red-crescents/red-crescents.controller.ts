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
import { CreateRedCrescentDto } from './dto/create-red-crescent.dto';
import { FindRedCrescentsQueryDto } from './dto/find-red-crescents-query.dto';
import { UpdateRedCrescentDto } from './dto/update-red-crescent.dto';
import { RedCrescentsService } from './red-crescents.service';

@Controller('red-crescents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RedCrescentsController {
  constructor(private readonly redCrescents: RedCrescentsService) {}

  @Get()
  findAll(@Query() query: FindRedCrescentsQueryDto) {
    return this.redCrescents.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.redCrescents.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRedCrescentDto) {
    return this.redCrescents.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRedCrescentDto) {
    return this.redCrescents.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.redCrescents.remove(id);
  }
}
