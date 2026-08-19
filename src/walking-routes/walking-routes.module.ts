import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalkingRoutesController } from './walking-routes.controller';
import { WalkingRoutesService } from './walking-routes.service';

@Module({
  imports: [AuthModule],
  controllers: [WalkingRoutesController],
  providers: [WalkingRoutesService],
})
export class WalkingRoutesModule {}
