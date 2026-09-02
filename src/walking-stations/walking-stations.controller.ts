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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWalkingStationDto } from './dto/create-walking-station.dto';
import { FindWalkingStationsQueryDto } from './dto/find-walking-stations-query.dto';
import { UpdateWalkingStationDto } from './dto/update-walking-station.dto';
import { WalkingStationsService } from './walking-stations.service';

@Controller('walking-stations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WalkingStationsController {
  constructor(private readonly walkingStations: WalkingStationsService) {}

  @Get()
  findAll(@Query() query: FindWalkingStationsQueryDto) {
    return this.walkingStations.findAll(query);
  }

  @Get(':id/stays')
  listStays(@Param('id') id: string) {
    return this.walkingStations.listStays(id);
  }

  @Post(':id/evacuate')
  evacuate(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.walkingStations.evacuate(id, actor.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.walkingStations.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWalkingStationDto) {
    return this.walkingStations.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWalkingStationDto) {
    return this.walkingStations.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.walkingStations.remove(id);
  }
}
