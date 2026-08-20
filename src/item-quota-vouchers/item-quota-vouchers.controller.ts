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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateItemQuotaVoucherDto } from './dto/create-item-quota-voucher.dto';
import { FindItemQuotaVoucherReportQueryDto } from './dto/find-item-quota-voucher-report-query.dto';
import { FindItemQuotaVouchersQueryDto } from './dto/find-item-quota-vouchers-query.dto';
import { UpdateItemQuotaVoucherDto } from './dto/update-item-quota-voucher.dto';
import { ItemQuotaVouchersService } from './item-quota-vouchers.service';

type RequestUser = {
  id: string;
};

@Controller('item-quota-vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ItemQuotaVouchersController {
  constructor(private readonly vouchers: ItemQuotaVouchersService) {}

  @Get()
  findAll(@Query() query: FindItemQuotaVouchersQueryDto) {
    return this.vouchers.findAll(query);
  }

  @Get('report')
  report(@Query() query: FindItemQuotaVoucherReportQueryDto) {
    return this.vouchers.report(query);
  }

  @Get('mine')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMine(
    @Query() query: FindItemQuotaVouchersQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.vouchers.findMine(query, actor.id);
  }

  @Get('mine/:id')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMineOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.vouchers.findMineOne(id, actor.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vouchers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateItemQuotaVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemQuotaVoucherDto) {
    return this.vouchers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vouchers.remove(id);
  }
}
