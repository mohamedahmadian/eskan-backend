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
import { CreateSupplierItemDto } from './dto/create-supplier-item.dto';
import { FindSupplierItemsQueryDto } from './dto/find-supplier-items-query.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-item.dto';
import { SupplierItemsService } from './supplier-items.service';

@Controller('supplier-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SupplierItemsController {
  constructor(private readonly supplierItems: SupplierItemsService) {}

  @Get()
  findAll(@Query() query: FindSupplierItemsQueryDto) {
    return this.supplierItems.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierItems.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSupplierItemDto) {
    return this.supplierItems.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierItemDto) {
    return this.supplierItems.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierItems.remove(id);
  }
}
