import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CalculateFromServingsBatchDto,
  CalculateFromServingsDto,
} from './dto/calculate-from-servings.dto';
import { CalculateFromStockDto } from './dto/calculate-from-stock.dto';
import { WarehouseCalculatorService } from './warehouse-calculator.service';

@Controller('warehouse-calculator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WarehouseCalculatorController {
  constructor(private readonly calculator: WarehouseCalculatorService) {}

  @Post('from-servings')
  fromServings(@Body() dto: CalculateFromServingsDto) {
    return this.calculator.fromServings(dto);
  }

  @Post('from-servings-batch')
  fromServingsBatch(@Body() dto: CalculateFromServingsBatchDto) {
    return this.calculator.fromServingsBatch(dto);
  }

  @Post('from-stock')
  fromStock(@Body() dto: CalculateFromStockDto) {
    return this.calculator.fromStock(dto);
  }
}
