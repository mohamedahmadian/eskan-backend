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
import { CreateFoodSupplierDto } from './dto/create-food-supplier.dto';
import { FindFoodSuppliersQueryDto } from './dto/find-food-suppliers-query.dto';
import { UpdateFoodSupplierDto } from './dto/update-food-supplier.dto';
import { FoodSuppliersService } from './food-suppliers.service';

@Controller('food-suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FoodSuppliersController {
  constructor(private readonly foodSuppliers: FoodSuppliersService) {}

  @Get()
  findAll(@Query() query: FindFoodSuppliersQueryDto) {
    return this.foodSuppliers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.foodSuppliers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFoodSupplierDto) {
    return this.foodSuppliers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFoodSupplierDto) {
    return this.foodSuppliers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.foodSuppliers.remove(id);
  }
}
