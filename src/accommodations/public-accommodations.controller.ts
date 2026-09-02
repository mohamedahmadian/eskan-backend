import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AccommodationsService } from './accommodations.service';

@Controller('public/accommodations')
export class PublicAccommodationsController {
  constructor(private readonly accommodations: AccommodationsService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accommodations.findPublicOne(id);
  }
}
