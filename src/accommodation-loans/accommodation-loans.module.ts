import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupplierItemsModule } from '../supplier-items/supplier-items.module';
import { AccommodationLoansController } from './accommodation-loans.controller';
import { AccommodationLoansService } from './accommodation-loans.service';

@Module({
  imports: [AuthModule, SupplierItemsModule],
  controllers: [AccommodationLoansController],
  providers: [AccommodationLoansService],
})
export class AccommodationLoansModule {}
