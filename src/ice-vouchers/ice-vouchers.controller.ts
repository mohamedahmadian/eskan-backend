import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIceVoucherDto } from './dto/create-ice-voucher.dto';
import { FindIceVoucherReportQueryDto } from './dto/find-ice-voucher-report-query.dto';
import { FindIceVouchersQueryDto } from './dto/find-ice-vouchers-query.dto';
import { IceVoucherQuotaQueryDto } from './dto/ice-voucher-quota-query.dto';
import { PayIceVouchersDto } from './dto/pay-ice-vouchers.dto';
import { UpdateIceVoucherDto } from './dto/update-ice-voucher.dto';
import { UpdateIceVoucherSettingsDto } from './dto/update-ice-voucher-settings.dto';
import { IceVouchersService } from './ice-vouchers.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

@Controller('ice-vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class IceVouchersController {
  constructor(private readonly iceVouchers: IceVouchersService) {}

  @Get('settings')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  getSettings() {
    return this.iceVouchers.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateIceVoucherSettingsDto) {
    return this.iceVouchers.updateSettings(dto);
  }

  @Get('quota')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  quota(
    @Query() query: IceVoucherQuotaQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.iceVouchers.quota(query.accommodationId, actor);
  }

  @Get('accommodations')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  usableAccommodations(@CurrentUser() actor: RequestUser) {
    return this.iceVouchers.usableAccommodations(actor);
  }

  @Get('report')
  report(@Query() query: FindIceVoucherReportQueryDto) {
    return this.iceVouchers.report(query);
  }

  @Get('stats')
  stats(@Query() query: FindIceVoucherReportQueryDto) {
    return this.iceVouchers.stats(query);
  }

  @Get('mine')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMine(
    @Query() query: FindIceVouchersQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.iceVouchers.findMine(query, actor.id);
  }

  @Get('mine/stats')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  mineStats(
    @Query() query: FindIceVoucherReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.iceVouchers.mineStats(query, actor.id);
  }

  @Get('mine/:id')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMineOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.iceVouchers.findMineOne(id, actor.id);
  }

  @Post('mine/pay')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  payMine(@Body() dto: PayIceVouchersDto, @CurrentUser() actor: RequestUser) {
    return this.iceVouchers.payMine(dto.ids, actor);
  }

  @Post('mine')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  createMine(
    @Body() dto: CreateIceVoucherDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.iceVouchers.createMine(dto, actor);
  }

  @Delete('mine/:id')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  removeMine(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.iceVouchers.removeMine(id, actor.id);
  }

  @Get()
  findAll(@Query() query: FindIceVouchersQueryDto) {
    return this.iceVouchers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iceVouchers.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIceVoucherDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.iceVouchers.update(id, dto, actor);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.iceVouchers.approve(id, actor.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.iceVouchers.reject(id, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.iceVouchers.remove(id);
  }
}
