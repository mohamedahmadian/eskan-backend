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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAccommodationTypeDto } from './dto/create-accommodation-type.dto';
import { FindAccommodationTypesQueryDto } from './dto/find-accommodation-types-query.dto';
import { UpdateAccommodationTypeDto } from './dto/update-accommodation-type.dto';
import { AccommodationTypesService } from './accommodation-types.service';

@Controller('accommodation-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccommodationTypesController {
  constructor(private readonly accommodationTypes: AccommodationTypesService) {}

  @Get()
  @Public()
  findAll(@Query() query: FindAccommodationTypesQueryDto) {
    return this.accommodationTypes.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accommodationTypes.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateAccommodationTypeDto) {
    return this.accommodationTypes.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAccommodationTypeDto) {
    return this.accommodationTypes.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.accommodationTypes.remove(id);
  }
}
