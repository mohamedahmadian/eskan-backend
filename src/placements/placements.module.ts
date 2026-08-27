import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlacementsController } from './placements.controller';
import { PlacementsScheduler } from './placements.scheduler';
import { PlacementsService } from './placements.service';

@Module({
  imports: [AuthModule],
  controllers: [PlacementsController],
  providers: [PlacementsService, PlacementsScheduler],
  exports: [PlacementsService],
})
export class PlacementsModule {}
