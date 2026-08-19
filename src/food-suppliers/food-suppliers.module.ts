import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoodSuppliersController } from './food-suppliers.controller';
import { FoodSuppliersService } from './food-suppliers.service';

@Module({
  imports: [AuthModule],
  controllers: [FoodSuppliersController],
  providers: [FoodSuppliersService],
})
export class FoodSuppliersModule {}
