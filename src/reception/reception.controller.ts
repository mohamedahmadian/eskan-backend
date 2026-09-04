import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SearchReceptionQueryDto } from './dto/search-reception.dto';
import { ReceptionService } from './reception.service';

@Controller('reception')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReceptionController {
  constructor(private readonly reception: ReceptionService) {}

  @Get('search')
  search(@Query() query: SearchReceptionQueryDto) {
    return this.reception.search(query);
  }

  @Get('people/:id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.reception.profile(id);
  }
}
