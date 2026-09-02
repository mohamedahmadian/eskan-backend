import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantMealPlansController } from './restaurant-meal-plans.controller';
import { RestaurantMealPlansService } from './restaurant-meal-plans.service';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantMealPlansController],
  providers: [RestaurantMealPlansService],
  exports: [RestaurantMealPlansService],
})
export class RestaurantMealPlansModule {}
