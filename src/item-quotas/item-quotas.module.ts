import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemQuotasController } from './item-quotas.controller';
import { ItemQuotasService } from './item-quotas.service';

@Module({
  imports: [AuthModule],
  controllers: [ItemQuotasController],
  providers: [ItemQuotasService],
  exports: [ItemQuotasService],
})
export class ItemQuotasModule {}
