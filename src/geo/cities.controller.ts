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
import { CreateCityDto } from './dto/create-city.dto';
import { FindGeoQueryDto } from './dto/find-geo-query.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { GeoService } from './geo.service';

@Controller('cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  findAll(@Query() query: FindGeoQueryDto) {
    return this.geo.findCities(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.geo.findCity(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateCityDto) {
    return this.geo.createCity(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.geo.updateCity(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.geo.removeCity(id);
  }
}
