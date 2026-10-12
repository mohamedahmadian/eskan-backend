import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PublicIntroduceAccommodationDto } from './dto/public-introduce-accommodation.dto';
import { AccommodationsService } from './accommodations.service';

@Controller('public/accommodations')
export class PublicAccommodationsController {
  constructor(private readonly accommodations: AccommodationsService) {}

  @Post('introduce')
  introduce(@Body() dto: PublicIntroduceAccommodationDto) {
    return this.accommodations.introducePublic(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accommodations.findPublicOne(id);
  }
}
