import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccommodationsController } from './accommodations.controller';
import { AccommodationsService } from './accommodations.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AccommodationsController],
  providers: [AccommodationsService],
})
export class AccommodationsModule {}
