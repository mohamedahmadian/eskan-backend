import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupplierItemsController } from './supplier-items.controller';
import { SupplierItemsService } from './supplier-items.service';

@Module({
  imports: [AuthModule],
  controllers: [SupplierItemsController],
  providers: [SupplierItemsService],
  exports: [SupplierItemsService],
})
export class SupplierItemsModule {}
