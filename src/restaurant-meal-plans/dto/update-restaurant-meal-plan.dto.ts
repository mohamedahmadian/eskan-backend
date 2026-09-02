import { PartialType } from '@nestjs/mapped-types';
import { CreateRestaurantMealPlanDto } from './create-restaurant-meal-plan.dto';

export class UpdateRestaurantMealPlanDto extends PartialType(
  CreateRestaurantMealPlanDto,
) {}
