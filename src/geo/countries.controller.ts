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
import { CreateCountryDto } from './dto/create-country.dto';
import { FindGeoQueryDto } from './dto/find-geo-query.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { GeoService } from './geo.service';

@Controller('countries')
@UseGuards(JwtAuthGuard)
export class CountriesController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  findAll(@Query() query: FindGeoQueryDto) {
    return this.geo.findCountries(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.geo.findCountry(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateCountryDto) {
    return this.geo.createCountry(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateCountryDto) {
    return this.geo.updateCountry(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.geo.removeCountry(id);
  }
}
