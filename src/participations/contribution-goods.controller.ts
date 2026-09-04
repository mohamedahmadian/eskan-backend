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
import { ContributionGoodsService } from './contribution-goods.service';
import { CreateContributionGoodDto } from './dto/create-contribution-good.dto';
import { FindContributionGoodsQueryDto } from './dto/find-contribution-goods-query.dto';
import { UpdateContributionGoodDto } from './dto/update-contribution-good.dto';

@Controller('contribution-goods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ContributionGoodsController {
  constructor(private readonly goods: ContributionGoodsService) {}

  @Get()
  findAll(@Query() query: FindContributionGoodsQueryDto) {
    return this.goods.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goods.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContributionGoodDto) {
    return this.goods.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContributionGoodDto) {
    return this.goods.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.goods.remove(id);
  }
}
