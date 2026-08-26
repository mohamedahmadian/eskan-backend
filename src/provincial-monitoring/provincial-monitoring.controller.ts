import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FindProvincialMonitoringQueryDto } from './dto/find-provincial-monitoring-query.dto';
import { ProvincialMonitoringService } from './provincial-monitoring.service';

@Controller('provincial-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProvincialMonitoringController {
  constructor(private readonly monitoring: ProvincialMonitoringService) {}

  @Get()
  map(@Query() query: FindProvincialMonitoringQueryDto) {
    return this.monitoring.map(query.year);
  }

  @Get('export')
  async exportMap(@Query() query: FindProvincialMonitoringQueryDto) {
    const { buffer, filename } = await this.monitoring.exportMap(query.year);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('provinces/:id/export')
  async exportProvince(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindProvincialMonitoringQueryDto,
  ) {
    const { buffer, filename } = await this.monitoring.exportProvince(
      id,
      query.year,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('provinces/:id')
  province(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindProvincialMonitoringQueryDto,
  ) {
    return this.monitoring.province(id, query.year);
  }

  @Get('cities/:id/export')
  async exportCity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindProvincialMonitoringQueryDto,
  ) {
    const { buffer, filename } = await this.monitoring.exportCity(id, query.year);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('cities/:id')
  city(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindProvincialMonitoringQueryDto,
  ) {
    return this.monitoring.city(id, query.year);
  }
}
