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
import { CreatePlaceTypeDto } from './dto/create-place-type.dto';
import { FindPlaceTypesQueryDto } from './dto/find-place-types-query.dto';
import { UpdatePlaceTypeDto } from './dto/update-place-type.dto';
import { PlaceTypesService } from './place-types.service';

@Controller('place-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlaceTypesController {
  constructor(private readonly placeTypes: PlaceTypesService) {}

  @Get()
  findAll(@Query() query: FindPlaceTypesQueryDto) {
    return this.placeTypes.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.placeTypes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlaceTypeDto) {
    return this.placeTypes.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlaceTypeDto) {
    return this.placeTypes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.placeTypes.remove(id);
  }
}
