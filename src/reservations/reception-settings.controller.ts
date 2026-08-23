import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateReceptionSettingsDto } from './dto/update-reception-settings.dto';
import { ReservationsService } from './reservations.service';

@Controller('reception-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
export class ReceptionSettingsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get(':year/capacity')
  getCapacity(@Param('year', ParseIntPipe) year: number) {
    return this.reservations.getCapacity(year);
  }

  @Get(':year')
  getSettings(@Param('year', ParseIntPipe) year: number) {
    return this.reservations.getSettings(year);
  }

  @Put(':year')
  @Roles('ADMIN')
  upsertSettings(
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpdateReceptionSettingsDto,
  ) {
    return this.reservations.upsertSettings(year, dto);
  }
}
