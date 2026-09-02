import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalkingStationsController } from './walking-stations.controller';
import { WalkingStationsService } from './walking-stations.service';

@Module({
  imports: [AuthModule],
  controllers: [WalkingStationsController],
  providers: [WalkingStationsService],
})
export class WalkingStationsModule {}
