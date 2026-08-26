import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvincialMonitoringController } from './provincial-monitoring.controller';
import { ProvincialMonitoringService } from './provincial-monitoring.service';

@Module({
  imports: [AuthModule],
  controllers: [ProvincialMonitoringController],
  providers: [ProvincialMonitoringService],
})
export class ProvincialMonitoringModule {}
