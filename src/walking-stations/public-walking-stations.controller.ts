import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { WalkingStationsService } from './walking-stations.service';

@Controller('public/walking-stations')
export class PublicWalkingStationsController {
  constructor(private readonly walkingStations: WalkingStationsService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.walkingStations.findPublicOne(id);
  }
}
