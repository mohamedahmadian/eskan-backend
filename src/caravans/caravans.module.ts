import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { CaravansController } from './caravans.controller';
import { CaravansService } from './caravans.service';

@Module({
  imports: [AuthModule, UsersModule, SmsModule],
  controllers: [CaravansController],
  providers: [CaravansService],
  exports: [CaravansService],
})
export class CaravansModule {}
