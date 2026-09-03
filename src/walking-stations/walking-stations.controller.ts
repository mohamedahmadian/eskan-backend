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
import { FindStationReportQueryDto } from './dto/find-station-report-query.dto';
import { FindStationStaysQueryDto } from './dto/find-station-stays-query.dto';
import { FindWalkingStationsQueryDto } from './dto/find-walking-stations-query.dto';
import { UpdateStationStayPresenceDto } from './dto/update-station-stay-presence.dto';
import { UpdateWalkingStationDto } from './dto/update-walking-station.dto';
import { type StationActor, WalkingStationsService } from './walking-stations.service';

@Controller('walking-stations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STATION_MANAGER')
export class WalkingStationsController {
  constructor(private readonly walkingStations: WalkingStationsService) {}

  @Get()
  findAll(
    @Query() query: FindWalkingStationsQueryDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.findAll(query, actor);
  }

  @Get('mine')
  findMine(
    @Query() query: FindWalkingStationsQueryDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.findMine(query, actor);
  }

  @Get('report')
  report(
    @Query() query: FindStationReportQueryDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.report(query, actor);
  }

  @Get('history')
  history(
    @Query() query: FindStationStaysQueryDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.history(query, actor);
  }

  @Get(':id/stays')
  listStays(
    @Param('id') id: string,
    @Query() query: FindStationStaysQueryDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.listStays(id, query, actor);
  }

  @Post(':id/evacuate')
  evacuate(@Param('id') id: string, @CurrentUser() actor: StationActor) {
    return this.walkingStations.evacuate(id, actor);
  }

  @Patch(':id/stays/:stayId')
  updateStayPresence(
    @Param('id') id: string,
    @Param('stayId') stayId: string,
    @Body() dto: UpdateStationStayPresenceDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.updateStayPresence(id, stayId, dto.present, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: StationActor) {
    return this.walkingStations.findOne(id, actor);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateWalkingStationDto) {
    return this.walkingStations.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWalkingStationDto,
    @CurrentUser() actor: StationActor,
  ) {
    return this.walkingStations.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() actor: StationActor) {
    return this.walkingStations.remove(id, actor);
  }
}
