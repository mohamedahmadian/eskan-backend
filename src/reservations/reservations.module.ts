import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PlacementsModule } from '../placements/placements.module';
import { ReceptionSettingsController } from './reception-settings.controller';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [AuthModule, UsersModule, PlacementsModule],
  controllers: [ReservationsController, ReceptionSettingsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
