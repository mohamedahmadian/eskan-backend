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
import { CreatePlaceDto } from './dto/create-place.dto';
import { FindPlacesQueryDto } from './dto/find-places-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlacesService } from './places.service';

@Controller('places')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  findAll(@Query() query: FindPlacesQueryDto) {
    return this.places.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.places.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlaceDto) {
    return this.places.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlaceDto) {
    return this.places.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.places.remove(id);
  }
}
