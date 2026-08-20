import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemQuotasModule } from '../item-quotas/item-quotas.module';
import { ItemQuotaVouchersController } from './item-quota-vouchers.controller';
import { ItemQuotaVouchersService } from './item-quota-vouchers.service';

@Module({
  imports: [AuthModule, ItemQuotasModule],
  controllers: [ItemQuotaVouchersController],
  providers: [ItemQuotaVouchersService],
  exports: [ItemQuotaVouchersService],
})
export class ItemQuotaVouchersModule {}
