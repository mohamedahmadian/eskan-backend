import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRestaurantMealPlanDistributionDto } from './dto/create-restaurant-meal-plan-distribution.dto';
import { CreateRestaurantMealPlanDto } from './dto/create-restaurant-meal-plan.dto';
import { FindRestaurantMealPlansQueryDto } from './dto/find-restaurant-meal-plans-query.dto';
import { UpdateRestaurantMealPlanDto } from './dto/update-restaurant-meal-plan.dto';
import { RestaurantMealPlansService } from './restaurant-meal-plans.service';

@Controller('restaurant-meal-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RestaurantMealPlansController {
  constructor(private readonly mealPlans: RestaurantMealPlansService) {}

  @Get()
  findAll(@Query() query: FindRestaurantMealPlansQueryDto) {
    return this.mealPlans.findAll(query);
  }

  @Get(':id/distributions')
  findDistributions(@Param('id') id: string) {
    return this.mealPlans.findDistributions(id);
  }

  @Get(':id/distribution-accommodations')
  findDistributionAccommodations(@Param('id') id: string) {
    return this.mealPlans.findDistributionAccommodations(id);
  }

  @Post(':id/distributions')
  createDistribution(
    @Param('id') id: string,
    @Body() dto: CreateRestaurantMealPlanDistributionDto,
  ) {
    return this.mealPlans.createDistribution(id, dto);
  }

  @Delete(':id/distributions/:distributionId')
  removeDistribution(
    @Param('id') id: string,
    @Param('distributionId') distributionId: string,
  ) {
    return this.mealPlans.removeDistribution(id, distributionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mealPlans.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRestaurantMealPlanDto) {
    return this.mealPlans.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRestaurantMealPlanDto) {
    return this.mealPlans.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mealPlans.remove(id);
  }
}
