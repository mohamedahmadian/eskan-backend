import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WalkingStationsController } from './walking-stations.controller';
import { WalkingStationsService } from './walking-stations.service';
import { PublicWalkingStationsController } from './public-walking-stations.controller';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [WalkingStationsController, PublicWalkingStationsController],
  providers: [WalkingStationsService],
})
export class WalkingStationsModule {}
