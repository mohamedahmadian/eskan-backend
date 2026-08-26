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
import { CreateEntryBorderDto } from './dto/create-entry-border.dto';
import { FindEntryBordersQueryDto } from './dto/find-entry-borders-query.dto';
import { UpdateEntryBorderDto } from './dto/update-entry-border.dto';
import { EntryBordersService } from './entry-borders.service';

@Controller('entry-borders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EntryBordersController {
  constructor(private readonly entryBorders: EntryBordersService) {}

  @Get()
  findAll(@Query() query: FindEntryBordersQueryDto) {
    return this.entryBorders.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.entryBorders.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEntryBorderDto) {
    return this.entryBorders.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEntryBorderDto) {
    return this.entryBorders.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.entryBorders.remove(id);
  }
}
