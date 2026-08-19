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
import { PaginationQueryDto } from '../common/pagination';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';
import { CaravansService } from './caravans.service';

@Controller('caravans')
@UseGuards(JwtAuthGuard)
export class CaravansController {
  constructor(private readonly caravans: CaravansService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.caravans.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.caravans.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCaravanDto) {
    return this.caravans.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCaravanDto) {
    return this.caravans.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caravans.remove(id);
  }
}
