import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WarehouseCalculatorController } from './warehouse-calculator.controller';
import { WarehouseCalculatorService } from './warehouse-calculator.service';

@Module({
  imports: [AuthModule],
  controllers: [WarehouseCalculatorController],
  providers: [WarehouseCalculatorService],
})
export class WarehouseCalculatorModule {}
