import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { AccommodationsController } from './accommodations.controller';
import { AccommodationsService } from './accommodations.service';
import { PublicAccommodationsController } from './public-accommodations.controller';

@Module({
  imports: [AuthModule, UsersModule, SmsModule],
  controllers: [AccommodationsController, PublicAccommodationsController],
  providers: [AccommodationsService],
})
export class AccommodationsModule {}
