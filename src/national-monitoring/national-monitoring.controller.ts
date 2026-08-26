import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  FindNationalMonitoringExportQueryDto,
  FindNationalMonitoringQueryDto,
} from './dto/find-national-monitoring-query.dto';
import { NationalMonitoringService } from './national-monitoring.service';

@Controller('national-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class NationalMonitoringController {
  constructor(private readonly monitoring: NationalMonitoringService) {}

  @Get()
  dashboard(@Query() query: FindNationalMonitoringQueryDto) {
    return this.monitoring.dashboard(query.year);
  }

  @Get('export')
  async export(@Query() query: FindNationalMonitoringExportQueryDto) {
    const { buffer, filename } = await this.monitoring.export(
      query.section,
      query.year,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
