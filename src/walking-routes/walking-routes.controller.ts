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
import { CreateWalkingRouteDto } from './dto/create-walking-route.dto';
import { FindWalkingRoutesQueryDto } from './dto/find-walking-routes-query.dto';
import { UpdateWalkingRouteDto } from './dto/update-walking-route.dto';
import { WalkingRoutesService } from './walking-routes.service';

@Controller('walking-routes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WalkingRoutesController {
  constructor(private readonly walkingRoutes: WalkingRoutesService) {}

  @Get()
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER', 'GROUP_MANAGER')
  findAll(@Query() query: FindWalkingRoutesQueryDto) {
    return this.walkingRoutes.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER', 'GROUP_MANAGER')
  findOne(@Param('id') id: string) {
    return this.walkingRoutes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWalkingRouteDto) {
    return this.walkingRoutes.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWalkingRouteDto) {
    return this.walkingRoutes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.walkingRoutes.remove(id);
  }
}
