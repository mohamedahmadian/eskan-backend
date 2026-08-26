import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NationalMonitoringController } from './national-monitoring.controller';
import { NationalMonitoringService } from './national-monitoring.service';

@Module({
  imports: [AuthModule],
  controllers: [NationalMonitoringController],
  providers: [NationalMonitoringService],
})
export class NationalMonitoringModule {}
