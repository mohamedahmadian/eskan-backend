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
import { CreateProvinceDto } from './dto/create-province.dto';
import { FindGeoQueryDto } from './dto/find-geo-query.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';
import { GeoService } from './geo.service';

@Controller('provinces')
@UseGuards(JwtAuthGuard)
export class ProvincesController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  findAll(@Query() query: FindGeoQueryDto) {
    return this.geo.findProvinces(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.geo.findProvince(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateProvinceDto) {
    return this.geo.createProvince(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateProvinceDto) {
    return this.geo.updateProvince(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.geo.removeProvince(id);
  }
}
