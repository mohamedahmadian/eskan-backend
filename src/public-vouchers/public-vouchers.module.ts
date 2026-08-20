import { Module } from '@nestjs/common';
import { IceVouchersModule } from '../ice-vouchers/ice-vouchers.module';
import { ItemQuotaVouchersModule } from '../item-quota-vouchers/item-quota-vouchers.module';
import { PublicVouchersController } from './public-vouchers.controller';

@Module({
  imports: [ItemQuotaVouchersModule, IceVouchersModule],
  controllers: [PublicVouchersController],
})
export class PublicVouchersModule {}
