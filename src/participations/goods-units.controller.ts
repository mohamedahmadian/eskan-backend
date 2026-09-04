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
import { CreateGoodsUnitDto } from './dto/create-goods-unit.dto';
import { FindGoodsUnitsQueryDto } from './dto/find-goods-units-query.dto';
import { UpdateGoodsUnitDto } from './dto/update-goods-unit.dto';
import { GoodsUnitsService } from './goods-units.service';

@Controller('goods-units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GoodsUnitsController {
  constructor(private readonly goodsUnits: GoodsUnitsService) {}

  @Get()
  findAll(@Query() query: FindGoodsUnitsQueryDto) {
    return this.goodsUnits.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goodsUnits.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateGoodsUnitDto) {
    return this.goodsUnits.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGoodsUnitDto) {
    return this.goodsUnits.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.goodsUnits.remove(id);
  }
}
