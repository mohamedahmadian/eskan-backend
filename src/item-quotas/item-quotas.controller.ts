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
import { CreateItemQuotaDto } from './dto/create-item-quota.dto';
import { FindItemQuotasQueryDto } from './dto/find-item-quotas-query.dto';
import { UpdateItemQuotaDto } from './dto/update-item-quota.dto';
import { ItemQuotasService } from './item-quotas.service';

@Controller('item-quotas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ItemQuotasController {
  constructor(private readonly quotas: ItemQuotasService) {}

  @Get()
  findAll(@Query() query: FindItemQuotasQueryDto) {
    return this.quotas.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotas.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateItemQuotaDto) {
    return this.quotas.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemQuotaDto) {
    return this.quotas.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quotas.remove(id);
  }
}
