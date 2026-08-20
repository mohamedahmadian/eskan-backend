import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { IceVouchersController } from './ice-vouchers.controller';
import { IceVouchersService } from './ice-vouchers.service';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [IceVouchersController],
  providers: [IceVouchersService],
  exports: [IceVouchersService],
})
export class IceVouchersModule {}
